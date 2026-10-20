import { http, HttpResponse } from 'msw';
import { expect, test } from 'vitest';

import { server } from '@/test/setup';

import { completeSignIn } from './complete-sign-in';
import { buildAuthorizeUrl } from './pkce';
import { readAccessToken, readIsSignedIn } from './session';

test('exchanges the code with its verifier and goes into the app', async () => {
  // arrange
  const authorizeUrl = new URL(await buildAuthorizeUrl('TELEGRAM'), 'http://localhost');
  const state = authorizeUrl.searchParams.get('state') ?? '';
  let tokenRequest = new URLSearchParams();
  server.use(
    http.post('http://localhost/api/user/auth/token', async ({ request }) => {
      tokenRequest = new URLSearchParams(await request.text());

      return HttpResponse.json({ access_token: 'access-1', token_type: 'Bearer', expires_in: 900 });
    }),
  );

  // act
  const response = await completeSignIn({
    request: new Request(`http://localhost/auth/callback?code=code-1&state=${state}`),
  });

  // assert
  expect(response.headers.get('Location')).toBe('/');
  expect(readAccessToken()).toBe('access-1');
  expect(tokenRequest.get('grant_type')).toBe('authorization_code');
  expect(tokenRequest.get('code')).toBe('code-1');
  expect(tokenRequest.get('redirect_uri')).toBe('http://localhost:3000/auth/callback');
  // the verifier hashes to the challenge sent to the authorization endpoint
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(tokenRequest.get('code_verifier') ?? ''),
  );
  expect(Buffer.from(digest).toString('base64url')).toBe(
    authorizeUrl.searchParams.get('code_challenge'),
  );
});

test('returns to sign-in with the provider error', async () => {
  // arrange
  const authorizeUrl = new URL(await buildAuthorizeUrl('GOOGLE'), 'http://localhost');
  const state = authorizeUrl.searchParams.get('state') ?? '';

  // act
  const response = await completeSignIn({
    request: new Request(`http://localhost/auth/callback?error=access_denied&state=${state}`),
  });

  // assert
  expect(response.headers.get('Location')).toBe('/sign-in?error=access_denied');
  expect(readIsSignedIn()).toBe(false);
});

test.each([
  { name: 'another state', callbackQuery: 'code=code-1&state=foreign-state' },
  { name: 'no state', callbackQuery: 'code=code-1' },
])('returns to sign-in when the callback carries $name', async ({ callbackQuery }) => {
  // arrange
  await buildAuthorizeUrl('TELEGRAM');

  // act
  const response = await completeSignIn({
    request: new Request(`http://localhost/auth/callback?${callbackQuery}`),
  });

  // assert
  expect(response.headers.get('Location')).toBe('/sign-in?error=state_mismatch');
  expect(readIsSignedIn()).toBe(false);
});

test('accepts a callback only once', async () => {
  // arrange
  const authorizeUrl = new URL(await buildAuthorizeUrl('TELEGRAM'), 'http://localhost');
  const callbackUrl = `http://localhost/auth/callback?error=access_denied&state=${authorizeUrl.searchParams.get('state') ?? ''}`;
  await completeSignIn({ request: new Request(callbackUrl) });

  // act
  const response = await completeSignIn({ request: new Request(callbackUrl) });

  // assert
  expect(response.headers.get('Location')).toBe('/sign-in?error=state_mismatch');
});

test('returns to sign-in when the backend rejects the code', async () => {
  // arrange
  const authorizeUrl = new URL(await buildAuthorizeUrl('TELEGRAM'), 'http://localhost');
  const state = authorizeUrl.searchParams.get('state') ?? '';
  server.use(
    http.post('http://localhost/api/user/auth/token', () =>
      HttpResponse.json({ message: 'Invalid token', error_code: 'INVALID_TOKEN' }, { status: 401 }),
    ),
  );

  // act
  const response = await completeSignIn({
    request: new Request(`http://localhost/auth/callback?code=code-1&state=${state}`),
  });

  // assert
  expect(response.headers.get('Location')).toBe('/sign-in?error=invalid_grant');
  expect(readIsSignedIn()).toBe(false);
});
