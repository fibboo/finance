import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { server } from '@/test/setup';

import {
  readAccessToken,
  readIsSignedIn,
  refreshSession,
  restoreSession,
  signOut,
  startSession,
} from './session';

let otherTab = new BroadcastChannel('finance-session');

beforeEach(() => {
  otherTab = new BroadcastChannel('finance-session');
});

afterEach(() => {
  otherTab.close();
});

test('restores the session on startup through the refresh token', async () => {
  // arrange
  let grantType: FormDataEntryValue | null = null;
  server.use(
    http.post('http://localhost/api/user/auth/token', async ({ request }) => {
      grantType = (await request.formData()).get('grant_type');

      return HttpResponse.json({ access_token: 'access-1', token_type: 'Bearer', expires_in: 900 });
    }),
  );

  // act
  await restoreSession();

  // assert
  expect(grantType).toBe('refresh_token');
  expect(readAccessToken()).toBe('access-1');
});

test('broadcasts the refreshed token to the other tabs', async () => {
  // arrange
  const otherTabMessages: unknown[] = [];
  otherTab.addEventListener('message', (event) => {
    otherTabMessages.push(event.data);
  });
  server.use(
    http.post('http://localhost/api/user/auth/token', () =>
      HttpResponse.json({ access_token: 'access-1', token_type: 'Bearer', expires_in: 900 }),
    ),
  );

  // act
  await restoreSession();

  // assert
  await vi.waitFor(() => {
    expect(otherTabMessages).toContainEqual({ type: 'signed-in', access_token: 'access-1' });
  });
});

test('stays signed out when the refresh answers 401', async () => {
  // arrange
  server.use(
    http.post('http://localhost/api/user/auth/token', () =>
      HttpResponse.json({ message: 'Invalid token', error_code: 'INVALID_TOKEN' }, { status: 401 }),
    ),
  );

  // act
  await restoreSession();

  // assert
  expect(readIsSignedIn()).toBe(false);
});

test.each([
  ['a network error', () => HttpResponse.error()],
  ['a server error', () => HttpResponse.json({ message: 'Bad gateway' }, { status: 502 })],
])('keeps the session when the refresh fails with %s', async (_reason, resolver) => {
  // arrange
  startSession('access-1');
  server.use(http.post('http://localhost/api/user/auth/token', resolver));

  // act
  const result = refreshSession('access-1');

  // assert
  await expect(result).rejects.toThrow();
  expect(readAccessToken()).toBe('access-1');
});

test('takes the token another tab broadcast', async () => {
  // act
  otherTab.postMessage({ type: 'signed-in', access_token: 'from-other-tab' });

  // assert
  await vi.waitFor(() => {
    expect(readAccessToken()).toBe('from-other-tab');
  });
});

test('signs out when another tab signs out', async () => {
  // arrange
  startSession('access-1');

  // act
  otherTab.postMessage({ type: 'signed-out' });

  // assert
  await vi.waitFor(() => {
    expect(readIsSignedIn()).toBe(false);
  });
});

test('signs out through revoke and tells the other tabs', async () => {
  // arrange
  let revokeCount = 0;
  startSession('access-1');
  const otherTabMessages: unknown[] = [];
  otherTab.addEventListener('message', (event) => {
    otherTabMessages.push(event.data);
  });
  server.use(
    http.post('http://localhost/api/user/auth/revoke', () => {
      revokeCount += 1;

      return HttpResponse.json(null);
    }),
  );

  // act
  await signOut();

  // assert
  expect(revokeCount).toBe(1);
  expect(readIsSignedIn()).toBe(false);
  await vi.waitFor(() => {
    expect(otherTabMessages).toContainEqual({ type: 'signed-out' });
  });
});

test('keeps the session when the revoke fails', async () => {
  // arrange
  startSession('access-1');
  server.use(
    http.post('http://localhost/api/user/auth/revoke', () =>
      HttpResponse.json({ message: 'Origin not allowed' }, { status: 403 }),
    ),
  );

  // act
  const result = signOut();

  // assert
  await expect(result).rejects.toMatchObject({ status: 403 });
  expect(readAccessToken()).toBe('access-1');
});
