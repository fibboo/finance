import { http, HttpResponse } from 'msw';
import { expect, test, vi } from 'vitest';

import { apiClient, readData } from '@/lib/api-client';
import type { components } from '@/lib/api-schema';
import { server } from '@/test/setup';

import { authMiddleware } from './auth-middleware';
import { readAccessToken, readIsSignedIn, startSession } from './session';

const user = {
  id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
  username: 'nikita',
  avatar: null,
  registration_provider: 'TELEGRAM',
  base_currency: 'EUR',
  external_users: [],
} satisfies components['schemas']['User'];
const invalidToken = { message: 'Invalid token', error_code: 'INVALID_TOKEN' };

test('sends the access token with the request', async () => {
  // arrange
  let authorization: string | null = null;
  startSession('access-1');
  server.use(
    http.get('http://localhost/api/user/me', ({ request }) => {
      authorization = request.headers.get('Authorization');

      return HttpResponse.json(user);
    }),
  );

  // act
  await apiClient.GET('/user/me', { middleware: [authMiddleware] });

  // assert
  expect(authorization).toBe('Bearer access-1');
});

test('refreshes once for concurrent requests and retries them with the new token', async () => {
  // arrange
  let refreshCount = 0;
  startSession('expired');
  server.use(
    http.get('http://localhost/api/user/me', ({ request }) =>
      request.headers.get('Authorization') === 'Bearer fresh'
        ? HttpResponse.json(user)
        : HttpResponse.json(invalidToken, { status: 401 }),
    ),
    http.post('http://localhost/api/user/auth/token', () => {
      refreshCount += 1;

      return HttpResponse.json({ access_token: 'fresh', token_type: 'Bearer', expires_in: 900 });
    }),
  );

  // act
  const results = await Promise.all([
    apiClient.GET('/user/me', { middleware: [authMiddleware] }),
    apiClient.GET('/user/me', { middleware: [authMiddleware] }),
  ]);

  // assert
  expect(results.map((result) => readData(result).username)).toEqual(['nikita', 'nikita']);
  expect(refreshCount).toBe(1);
});

test('waits for the refresh of another tab and takes its token instead of refreshing', async () => {
  // arrange
  let refreshCount = 0;
  let releaseLock = (): void => undefined;
  startSession('expired');
  server.use(
    http.get('http://localhost/api/user/me', ({ request }) =>
      request.headers.get('Authorization') === 'Bearer from-other-tab'
        ? HttpResponse.json(user)
        : HttpResponse.json(invalidToken, { status: 401 }),
    ),
    http.post('http://localhost/api/user/auth/token', () => {
      refreshCount += 1;

      return HttpResponse.json({ access_token: 'fresh', token_type: 'Bearer', expires_in: 900 });
    }),
  );
  const otherTabLock = navigator.locks.request(
    'finance-session-refresh',
    () =>
      new Promise<void>((resolve) => {
        releaseLock = resolve;
      }),
  );
  const otherTab = new BroadcastChannel('finance-session');

  // act
  const result = apiClient.GET('/user/me', { middleware: [authMiddleware] });
  otherTab.postMessage({ type: 'signed-in', access_token: 'from-other-tab' });
  await vi.waitFor(() => {
    expect(readAccessToken()).toBe('from-other-tab');
  });
  releaseLock();
  await otherTabLock;

  // assert
  expect(readData(await result).username).toBe('nikita');
  expect(refreshCount).toBe(0);
  otherTab.close();
});

test('signs out when the refresh answers 401', async () => {
  // arrange
  startSession('expired');
  server.use(
    http.get('http://localhost/api/user/me', () =>
      HttpResponse.json(invalidToken, { status: 401 }),
    ),
    http.post('http://localhost/api/user/auth/token', () =>
      HttpResponse.json(invalidToken, { status: 401 }),
    ),
  );

  // act
  const result = apiClient.GET('/user/me', { middleware: [authMiddleware] });

  // assert
  await expect(result).rejects.toMatchObject({ status: 401 });
  expect(readIsSignedIn()).toBe(false);
});

test('keeps the session when the refresh fails', async () => {
  // arrange
  startSession('expired');
  server.use(
    http.get('http://localhost/api/user/me', () =>
      HttpResponse.json(invalidToken, { status: 401 }),
    ),
    http.post('http://localhost/api/user/auth/token', () => HttpResponse.error()),
  );

  // act
  const result = apiClient.GET('/user/me', { middleware: [authMiddleware] });

  // assert
  await expect(result).rejects.toThrow();
  expect(readAccessToken()).toBe('expired');
});
