import { screen, waitFor, within } from '@testing-library/react';
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
  expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Assets' })).toHaveTextContent('Wallet');
  expect(screen.getByRole('button', { name: 'New account' })).toBeDisabled();
});

test('narrows the groups to the accounts matching a term of at least 3 characters', async () => {
  // arrange
  const user = userEvent.setup();
  const searchTerms: (string | null)[] = [];
  server.use(
    http.get('http://localhost/api/accounting/accounts', ({ request }) => {
      const searchTerm = new URL(request.url).searchParams.get('search_term');
      searchTerms.push(searchTerm);
      const items = searchTerm === 'cre' ? [creditCard] : [wallet, creditCard];
      return HttpResponse.json({
        items,
        total: items.length,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']);
    }),
  );
  render(<Component />);
  await screen.findByRole('region', { name: 'Assets' });
  await user.type(screen.getByRole('searchbox', { name: 'Search accounts' }), 'cr');

  // act
  await user.type(screen.getByRole('searchbox', { name: 'Search accounts' }), 'e');

  // assert
  await waitFor(() => {
    expect(screen.queryByRole('region', { name: 'Assets' })).not.toBeInTheDocument();
  });
  expect(screen.getByRole('region', { name: 'Liabilities' })).toHaveTextContent('Credit card');
  expect(
    screen.getByRole('heading', { level: 1, name: 'Accounts, 2 accounts' }),
  ).toBeInTheDocument();
  expect(searchTerms).toEqual([null, 'cre']);
});

test('reads the term from the URL and clears it into a focused field when nothing matches', async () => {
  // arrange
  const user = userEvent.setup();
  server.use(
    http.get('http://localhost/api/accounting/accounts', ({ request }) => {
      const items =
        new URL(request.url).searchParams.get('search_term') === 'cash' ? [] : [wallet, creditCard];
      return HttpResponse.json({
        items,
        total: items.length,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']);
    }),
  );
  render(<Component />, { initialEntries: ['/?search=cash'] });
  expect(screen.getByRole('searchbox', { name: 'Search accounts' })).toHaveValue('cash');

  // act
  await user.click(await screen.findByRole('button', { name: 'Clear search' }));

  // assert
  expect(await screen.findByRole('region', { name: 'Assets' })).toHaveTextContent('Wallet');
  expect(screen.getByRole('searchbox', { name: 'Search accounts' })).toHaveValue('');
  expect(screen.getByRole('searchbox', { name: 'Search accounts' })).toHaveFocus();
  expect(screen.queryByText('No accounts match this search')).not.toBeInTheDocument();
});

const mainCard = {
  ...wallet,
  name: 'Main card',
  id: '5b6cd902-8c1a-4b9e-9d1f-0e6a3c2b1a06',
  balance: '3180.00',
  currency: 'EUR',
  color: '#5B6CD9',
  description: 'Salary card, Intesa',
  base_currency_rate: '0.9161',
  base_currency_balance: '3471.20',
} satisfies components['schemas']['Account'];

test('opens an account from its row with its balance, description and actions', async () => {
  // arrange
  const user = userEvent.setup();
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items: [wallet, mainCard],
        total: 2,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']),
    ),
    http.get(`http://localhost/api/accounting/accounts/${mainCard.id}`, () =>
      HttpResponse.json(mainCard),
    ),
  );
  render(<Component />);

  // act
  await user.click(await screen.findByRole('link', { name: 'Main card' }));

  // assert
  const details = await screen.findByRole('dialog', { name: 'Account details' });
  expect(await within(details).findByRole('heading', { name: 'Main card' })).toBeInTheDocument();
  expect(details).toHaveTextContent('Asset · EUR');
  expect(details).toHaveTextContent('€3,180.00');
  expect(details).toHaveTextContent('$3,471.20 · rate 0.9161');
  expect(details).toHaveTextContent('Salary card, Intesa');
  expect(within(details).getByRole('link', { name: 'Adjust balance' })).toHaveAttribute(
    'href',
    `/?account=${mainCard.id}&new_transaction=ADJUSTMENT&new_transaction_account=${mainCard.id}`,
  );
  expect(within(details).getByRole('link', { name: 'Transactions' })).toHaveAttribute(
    'href',
    `/transactions?account_ids=${mainCard.id}`,
  );
  expect(screen.getByRole('link', { name: 'Main card' })).toHaveAttribute('aria-current', 'true');
});

test.each([
  { currency: 'EUR', rate: '0.9161', baseBalance: '$3,471.20 · rate 0.9161' },
  { currency: 'EUR', rate: '0', baseBalance: '$3,471.20' },
  { currency: 'USD', rate: '1', baseBalance: '$3,471.20' },
])(
  'shows the rate of a $currency account at rate $rate only outside the base currency',
  async ({ currency, rate, baseBalance }) => {
    // arrange
    const account = { ...mainCard, currency, base_currency_rate: rate };
    server.use(
      http.get('http://localhost/api/accounting/accounts', () =>
        HttpResponse.json({
          items: [account],
          total: 1,
          page: 1,
          size: 100,
          pages: 1,
        } satisfies components['schemas']['Page_Account_']),
      ),
      http.get(`http://localhost/api/accounting/accounts/${mainCard.id}`, () =>
        HttpResponse.json(account),
      ),
    );

    // act
    render(<Component />, { initialEntries: [`/?account=${mainCard.id}`] });

    // assert
    const details = await screen.findByRole('dialog', { name: 'Account details' });
    await within(details).findByRole('heading', { name: 'Main card' });
    expect(within(details).getByText(baseBalance, { exact: true })).toBeInTheDocument();
  },
);

test('closes the account with Escape and returns focus to its row', async () => {
  // arrange
  const user = userEvent.setup();
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items: [mainCard],
        total: 1,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']),
    ),
    http.get(`http://localhost/api/accounting/accounts/${mainCard.id}`, () =>
      HttpResponse.json(mainCard),
    ),
  );
  render(<Component />);
  await user.click(await screen.findByRole('link', { name: 'Main card' }));
  await screen.findByRole('dialog', { name: 'Account details' });

  // act
  await user.keyboard('{Escape}');

  // assert
  await waitFor(() => {
    expect(screen.queryByRole('dialog', { name: 'Account details' })).not.toBeInTheDocument();
  });
  expect(screen.getByRole('link', { name: 'Main card' })).toHaveFocus();
});

test('drops the account param of an account that does not exist', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items: [mainCard],
        total: 1,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']),
    ),
    http.get(`http://localhost/api/accounting/accounts/${mainCard.id}`, () =>
      HttpResponse.json({ error_code: 'NOT_FOUND', message: 'Account not found' }, { status: 404 }),
    ),
  );

  // act
  render(<Component />, { initialEntries: [`/?account=${mainCard.id}`] });

  // assert
  const accountLink = await screen.findByRole('link', { name: 'Main card' });
  await waitFor(() => {
    expect(screen.queryByRole('dialog', { name: 'Account details' })).not.toBeInTheDocument();
  });
  expect(accountLink).not.toHaveAttribute('aria-current');
});
