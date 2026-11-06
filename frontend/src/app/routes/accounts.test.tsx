import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, expect, test } from 'vitest';

import type { components } from '@/lib/api-schema';
import { render } from '@/test/render';
import { server } from '@/test/setup';

import { Component } from './accounts';

const wallet = {
  name: 'Wallet',
  id: '7f0c2f4e-8c1a-4b9e-9d1f-0e6a3c2b1a03',
  user_id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
  kind: 'ASSET',
  balance: '412.50',
  currency: 'USD',
  color: '#4D8FBF',
  category_type: null,
  base_currency_rate: '1',
  status: 'ACTIVE',
  base_currency_balance: '412.50',
} satisfies components['schemas']['Account'];

const creditCard = {
  ...wallet,
  name: 'Credit card',
  id: '8c1a7f0c-2f4e-4b9e-9d1f-0e6a3c2b1a04',
  kind: 'LIABILITY',
  balance: '-318.40',
  color: '#C2613F',
  base_currency_balance: '-318.40',
} satisfies components['schemas']['Account'];

const travelCard = {
  ...wallet,
  name: 'Travel card',
  id: '2f4e8c1a-7f0c-4b9e-9d1f-0e6a3c2b1a05',
  balance: '0',
  color: '#5B6CD9',
  base_currency_balance: '0',
} satisfies components['schemas']['Account'];

beforeEach(() => {
  server.use(
    http.get('http://localhost/api/user/me', () =>
      HttpResponse.json({
        id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
        username: 'nikita',
        avatar: null,
        registration_provider: 'GOOGLE',
        base_currency: 'USD',
        external_users: [],
      } satisfies components['schemas']['User']),
    ),
    http.get('http://localhost/api/dictionaries/accounting', () =>
      HttpResponse.json({
        currencies: [{ key: 'USD', label: 'US Dollar' }],
        account_kinds: [
          { key: 'ASSET', label: 'Asset' },
          { key: 'LIABILITY', label: 'Liability' },
        ],
        category_types: [],
        transaction_types: [],
        transaction_orders: [],
      } satisfies components['schemas']['AccountingDictionaries']),
    ),
  );
});

test('shows the number of money accounts next to the title and lists them by kind', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/accounting/accounts', ({ request }) =>
      new URL(request.url).searchParams.getAll('kinds').join() === 'ASSET,LIABILITY'
        ? HttpResponse.json({
            items: [wallet, creditCard],
            total: 2,
            page: 1,
            size: 100,
            pages: 1,
          } satisfies components['schemas']['Page_Account_'])
        : HttpResponse.json(null, { status: 400 }),
    ),
  );

  // act
  render(<Component />);

  // assert
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Accounts, 2 accounts' }),
  ).toBeInTheDocument();
  expect(await screen.findByRole('region', { name: 'Assets' })).toHaveTextContent('Wallet');
  expect(screen.getByRole('region', { name: 'Liabilities' })).toHaveTextContent('Credit card');
});

test('creates an account from New account and lists it', async () => {
  // arrange
  const user = userEvent.setup();
  let accounts: components['schemas']['Account'][] = [wallet];
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items: accounts,
        total: accounts.length,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']),
    ),
    http.post('http://localhost/api/accounting/accounts', () => {
      accounts = [wallet, travelCard];
      return HttpResponse.json(travelCard);
    }),
  );
  render(<Component />);
  await screen.findByRole('region', { name: 'Assets' });
  await user.click(await screen.findByRole('button', { name: 'New account' }));
  const form = await screen.findByRole('form', { name: 'New account' });
  await user.type(within(form).getByRole('textbox', { name: 'Name' }), 'Travel card');

  // act
  await user.click(within(form).getByRole('button', { name: 'Create account' }));

  // assert
  expect(await screen.findByText('Travel card')).toBeInTheDocument();
  expect(screen.queryByRole('form', { name: 'New account' })).not.toBeInTheDocument();
});

test('keeps the accounts listed and New account disabled when the dictionary fails', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/dictionaries/accounting', () =>
      HttpResponse.json(null, { status: 500 }),
    ),
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items: [wallet],
        total: 1,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']),
    ),
  );

  // act
  render(<Component />);

  // assert
  expect(await screen.findByRole('region', { name: 'Assets' })).toHaveTextContent('Wallet');
  expect(screen.getByRole('button', { name: 'New account' })).toBeDisabled();
});
