import { http, HttpResponse } from 'msw';
import { expect, test } from 'vitest';

import type { components } from '@/lib/api-schema';
import { server } from '@/test/setup';

import { completeLink, startLink } from './link-provider';

const mergeOffer: components['schemas']['MergeOffer'] = {
  merge_code: 'merge-code-1',
  username: 'anna',
  base_currency: 'USD',
  accounts_count: 6,
  transactions_count: 214,
  is_base_currency_mismatch: false,
  is_provider_conflict: false,
};

test('completes the link with the verifier of the challenge it started with', async () => {
  // arrange
  let linkQuery = new URLSearchParams();
  let completeBody: unknown = null;
  server.use(
    http.post('http://localhost/api/user/auth/link/GOOGLE', ({ request }) => {
      linkQuery = new URL(request.url).searchParams;
      return HttpResponse.json({ authorization_url: 'https://accounts.google.test/authorize' });
    }),
    http.post('http://localhost/api/user/auth/link/GOOGLE/complete', async ({ request }) => {
      completeBody = await request.json();
      return HttpResponse.json({
        status: 'merge_required',
        merge_offer: mergeOffer,
      } satisfies components['schemas']['LinkResult']);
    }),
  );
  const authorizationUrl = await startLink('GOOGLE');
  const state = linkQuery.get('state') ?? '';

  // act
  const completedLink = await completeLink({
    request: new Request(`http://localhost/auth/link-callback?code=code-1&state=${state}`),
  });

  // assert
  expect(authorizationUrl).toBe('https://accounts.google.test/authorize');
  expect(linkQuery.get('redirect_uri')).toBe('http://localhost:3000/auth/link-callback');
  expect(linkQuery.get('code_challenge_method')).toBe('S256');
  expect(completedLink).toEqual({
    provider: 'GOOGLE',
    link_result: { status: 'merge_required', merge_offer: mergeOffer },
  });
  expect(completeBody).toMatchObject({
    code: 'code-1',
    redirect_uri: 'http://localhost:3000/auth/link-callback',
  });
  // the verifier hashes to the challenge sent when the link started
  const codeVerifier =
    typeof completeBody === 'object' && completeBody !== null && 'code_verifier' in completeBody
      ? String(completeBody.code_verifier)
      : '';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
  expect(Buffer.from(digest).toString('base64url')).toBe(linkQuery.get('code_challenge'));
});

test.each([
  { name: 'the provider error', callbackQuery: 'error=access_denied&state=:state' },
  { name: 'another state', callbackQuery: 'code=code-1&state=foreign-state' },
  { name: 'no state', callbackQuery: 'code=code-1' },
])('does not complete a callback with $name', async ({ callbackQuery }) => {
  // arrange
  let linkQuery = new URLSearchParams();
  server.use(
    http.post('http://localhost/api/user/auth/link/TELEGRAM', ({ request }) => {
      linkQuery = new URL(request.url).searchParams;
      return HttpResponse.json({ authorization_url: 'https://oauth.telegram.test/authorize' });
    }),
  );
  await startLink('TELEGRAM');

  // act
  const completedLink = await completeLink({
    request: new Request(
      `http://localhost/auth/link-callback?${callbackQuery.replace(':state', linkQuery.get('state') ?? '')}`,
    ),
  });

  // assert
  expect(completedLink).toBeNull();
});

test('accepts a callback only once', async () => {
  // arrange
  let linkQuery = new URLSearchParams();
  server.use(
    http.post('http://localhost/api/user/auth/link/GOOGLE', ({ request }) => {
      linkQuery = new URL(request.url).searchParams;
      return HttpResponse.json({ authorization_url: 'https://accounts.google.test/authorize' });
    }),
    http.post('http://localhost/api/user/auth/link/GOOGLE/complete', () =>
      HttpResponse.json({
        status: 'linked',
        merge_offer: null,
      } satisfies components['schemas']['LinkResult']),
    ),
  );
  await startLink('GOOGLE');
  const callbackUrl = `http://localhost/auth/link-callback?code=code-1&state=${linkQuery.get('state') ?? ''}`;
  await completeLink({ request: new Request(callbackUrl) });

  // act
  const completedLink = await completeLink({ request: new Request(callbackUrl) });

  // assert
  expect(completedLink).toBeNull();
});

test('does not complete a link the backend rejects', async () => {
  // arrange
  let linkQuery = new URLSearchParams();
  server.use(
    http.post('http://localhost/api/user/auth/link/GOOGLE', ({ request }) => {
      linkQuery = new URL(request.url).searchParams;
      return HttpResponse.json({ authorization_url: 'https://accounts.google.test/authorize' });
    }),
    http.post('http://localhost/api/user/auth/link/GOOGLE/complete', () =>
      HttpResponse.json(
        { message: 'Provider already linked', error_code: 'PROVIDER_ALREADY_LINKED' },
        { status: 409 },
      ),
    ),
  );
  await startLink('GOOGLE');

  // act
  const completedLink = await completeLink({
    request: new Request(
      `http://localhost/auth/link-callback?code=code-1&state=${linkQuery.get('state') ?? ''}`,
    ),
  });

  // assert
  expect(completedLink).toBeNull();
});
