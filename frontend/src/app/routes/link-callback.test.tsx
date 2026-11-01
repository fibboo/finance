import { http, HttpResponse } from 'msw';
import { expect, test } from 'vitest';

import { loader } from '@/app/routes/link-callback';
import { readIsErrorShown } from '@/components/error-notification/error-notification-store';
import { startLink } from '@/features/auth/api/link-provider';
import type { components } from '@/lib/api-schema';
import { server } from '@/test/setup';

test('goes home once the provider is linked', async () => {
  // arrange
  let linkQuery = new URLSearchParams();
  server.use(
    http.get('http://localhost/api/dictionaries/user', () =>
      HttpResponse.json({
        provider_types: [
          { key: 'TELEGRAM', label: 'Telegram' },
          { key: 'GOOGLE', label: 'Google' },
        ],
      } satisfies components['schemas']['UserDictionaries']),
    ),
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

  // act
  const response = await loader({
    request: new Request(
      `http://localhost/auth/link-callback?code=code-1&state=${linkQuery.get('state') ?? ''}`,
    ),
  });

  // assert
  expect(response instanceof Response ? response.headers.get('Location') : null).toBe('/');
  expect(readIsErrorShown()).toBe(false);
});

test('goes home with an error when the link does not finish', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/dictionaries/user', () =>
      HttpResponse.json({
        provider_types: [
          { key: 'TELEGRAM', label: 'Telegram' },
          { key: 'GOOGLE', label: 'Google' },
        ],
      } satisfies components['schemas']['UserDictionaries']),
    ),
  );

  // act
  const response = await loader({
    request: new Request('http://localhost/auth/link-callback?code=code-1&state=foreign-state'),
  });

  // assert
  expect(response instanceof Response ? response.headers.get('Location') : null).toBe('/');
  expect(readIsErrorShown()).toBe(true);
});

test('goes home without an error when the user cancels at the provider', async () => {
  // arrange
  let linkQuery = new URLSearchParams();
  server.use(
    http.get('http://localhost/api/dictionaries/user', () =>
      HttpResponse.json({
        provider_types: [
          { key: 'TELEGRAM', label: 'Telegram' },
          { key: 'GOOGLE', label: 'Google' },
        ],
      } satisfies components['schemas']['UserDictionaries']),
    ),
    http.post('http://localhost/api/user/auth/link/GOOGLE', ({ request }) => {
      linkQuery = new URL(request.url).searchParams;
      return HttpResponse.json({ authorization_url: 'https://accounts.google.test/authorize' });
    }),
  );
  await startLink('GOOGLE');

  // act
  const response = await loader({
    request: new Request(
      `http://localhost/auth/link-callback?error=access_denied&state=${linkQuery.get('state') ?? ''}`,
    ),
  });

  // assert
  expect(response instanceof Response ? response.headers.get('Location') : null).toBe('/');
  expect(readIsErrorShown()).toBe(false);
});
