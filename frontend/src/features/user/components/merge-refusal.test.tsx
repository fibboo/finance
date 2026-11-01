import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { expect, test } from 'vitest';

import type { components } from '@/lib/api-schema';
import { render } from '@/test/render';
import { server } from '@/test/setup';

import { MergeRefusal } from './merge-refusal';

const providerTypes: components['schemas']['DictionaryItem'][] = [
  { key: 'TELEGRAM', label: 'Telegram' },
  { key: 'GOOGLE', label: 'Google' },
];

const user: components['schemas']['User'] = {
  id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
  username: 'nikita',
  avatar: null,
  registration_provider: 'TELEGRAM',
  base_currency: 'EUR',
  external_users: [
    {
      id: '6a7f3e0c-1f2b-4d4f-9a1c-0e5f8b2c7d10',
      user_id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
      provider: 'TELEGRAM',
      external_id: '1001',
      username: 'nikita',
    },
  ],
};

test('explains that accounts with different main currencies cannot be merged', async () => {
  // arrange
  server.use(http.get('http://localhost/api/user/me', () => HttpResponse.json(user)));

  // act
  render(
    <MergeRefusal
      provider="GOOGLE"
      providerTypes={providerTypes}
      mergeOffer={{
        merge_code: 'merge-code-1',
        username: 'anna',
        base_currency: 'USD',
        accounts_count: 6,
        transactions_count: 214,
        is_base_currency_mismatch: true,
        is_provider_conflict: false,
      }}
    />,
  );

  // assert
  expect(
    screen.getByRole('heading', { name: 'anna can’t be merged into your account' }),
  ).toBeInTheDocument();
  expect(
    screen.getByText('This Google sign-in belongs to anna, so it isn’t linked.'),
  ).toBeInTheDocument();
  expect(await screen.findByText('EUR')).toBeInTheDocument();
  expect(screen.getByText('USD')).toBeInTheDocument();
  expect(
    screen.getByText('Accounts with different main currencies can’t be merged.'),
  ).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Back to Home' })).toHaveAttribute('href', '/');
});

test('explains that both accounts sign in with the same provider', async () => {
  // arrange
  server.use(http.get('http://localhost/api/user/me', () => HttpResponse.json(user)));

  // act
  render(
    <MergeRefusal
      provider="GOOGLE"
      providerTypes={providerTypes}
      mergeOffer={{
        merge_code: 'merge-code-1',
        username: 'anna',
        base_currency: 'EUR',
        accounts_count: 6,
        transactions_count: 214,
        is_base_currency_mismatch: false,
        is_provider_conflict: true,
      }}
    />,
  );

  // assert
  expect(
    await screen.findByText(
      'anna also signs in with Telegram, and one account can have only one Telegram sign-in. Unlink Telegram from one of the two accounts, then link Google again.',
    ),
  ).toBeInTheDocument();
});
