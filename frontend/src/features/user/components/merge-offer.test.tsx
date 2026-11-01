import { screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { expect, test, vi } from 'vitest';

import type { components } from '@/lib/api-schema';
import { render } from '@/test/render';
import { server } from '@/test/setup';

import { MergeOffer } from './merge-offer';

const providerTypes: components['schemas']['DictionaryItem'][] = [
  { key: 'TELEGRAM', label: 'Telegram' },
  { key: 'GOOGLE', label: 'Google' },
];

const mergeOffer: components['schemas']['MergeOffer'] = {
  merge_code: 'merge-code-1',
  username: 'anna',
  base_currency: 'USD',
  accounts_count: 6,
  transactions_count: 1214,
  is_base_currency_mismatch: false,
  is_provider_conflict: false,
};

const user: components['schemas']['User'] = {
  id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
  username: 'nikita',
  avatar: null,
  registration_provider: 'TELEGRAM',
  base_currency: 'USD',
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

test('shows what moves from the other account', async () => {
  // arrange
  server.use(http.get('http://localhost/api/user/me', () => HttpResponse.json(user)));

  // act
  render(<MergeOffer provider="GOOGLE" providerTypes={providerTypes} mergeOffer={mergeOffer} />);

  // assert
  expect(
    screen.getByRole('heading', { name: 'This Google sign-in belongs to another account' }),
  ).toBeInTheDocument();
  expect(
    await screen.findByText(
      'Merge it into yours to keep everything in one place and sign in with Telegram or Google.',
    ),
  ).toBeInTheDocument();
  expect(screen.getByText('AN')).toBeInTheDocument();
  expect(screen.getByText('Main currency USD')).toBeInTheDocument();
  expect(screen.getByText('6')).toBeInTheDocument();
  expect(screen.getByText('1,214')).toBeInTheDocument();
  expect(
    screen.getByText('The account anna is deleted. This can’t be undone.'),
  ).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Not now' })).toHaveAttribute('href', '/');
});

test('merges with the offer code and refetches the user', async () => {
  // arrange
  let mergeBody: unknown = null;
  let userRequestCount = 0;
  server.use(
    http.get('http://localhost/api/user/me', () => {
      userRequestCount += 1;
      return HttpResponse.json(user);
    }),
    http.post('http://localhost/api/user/auth/merge', async ({ request }) => {
      mergeBody = await request.json();
      return HttpResponse.json(user);
    }),
  );
  const userActions = userEvent.setup();
  render(<MergeOffer provider="GOOGLE" providerTypes={providerTypes} mergeOffer={mergeOffer} />);
  await screen.findByText(/sign in with Telegram or Google/);

  // act
  await userActions.click(screen.getByRole('button', { name: 'Merge' }));

  // assert
  await vi.waitFor(() => {
    expect(userRequestCount).toBe(2);
  });
  expect(mergeBody).toEqual({ merge_code: 'merge-code-1' });
});
