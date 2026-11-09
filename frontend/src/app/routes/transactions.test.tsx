import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { afterEach, beforeEach, expect, onTestFinished, test, vi } from 'vitest';

import type { components } from '@/lib/api-schema';
import { render } from '@/test/render';
import { server } from '@/test/setup';

import { Component } from './transactions';

const wallet = {
  name: 'Wallet',
  id: '7f0c2f4e-8c1a-4b9e-9d1f-0e6a3c2b1a03',
  user_id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
  kind: 'ASSET',
  balance: '412.50',
  currency: 'USD',
  color: null,
  category_type: null,
  base_currency_rate: '1',
  status: 'ACTIVE',
  base_currency_balance: '412.50',
} satisfies components['schemas']['Account'];

const category = {
  ...wallet,
  name: 'Groceries',
  id: '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f',
  kind: 'EXPENSE',
  currency: null,
  category_type: 'VARIABLE',
} satisfies components['schemas']['Account'];

const cafes = {
  ...category,
  name: 'Cafes',
  id: '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e60',
} satisfies components['schemas']['Account'];

const walletPosting = {
  id: '3e4f5a6b-7c8d-4e9f-8a0b-1c2d3e4f5a60',
  amount: '-42.80',
  currency: 'USD',
  base_amount: '-42.80',
  account: wallet,
} satisfies components['schemas']['Posting'];

const categoryPosting = {
  id: '3e4f5a6b-7c8d-4e9f-8a0b-1c2d3e4f5a61',
  amount: '42.80',
  currency: 'USD',
  base_amount: '42.80',
  account: category,
} satisfies components['schemas']['Posting'];

const expense = {
  id: '5a1d9c3e-2b4f-4e6a-8c7d-9e0f1a2b3c40',
  user_id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
  transaction_date: '2026-10-20',
  comment: null,
  base_currency_amount: '42.80',
  location: null,
  income_period: null,
  transaction_type: 'EXPENSE',
  status: 'ACTIVE',
  created_at: '2026-10-20T09:00:00Z',
  updated_at: '2026-10-20T09:00:00Z',
  postings: [walletPosting, categoryPosting],
} satisfies components['schemas']['Transaction'];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 20, 12));
  // 768 px of jsdom's window over 52 px rows give pages of 15
  document.documentElement.style.fontSize = '16px';
  document.documentElement.style.setProperty('--size-transaction-row', '3.25rem');
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
        currencies: [],
        account_kinds: [
          { key: 'ASSET', label: 'Asset' },
          { key: 'EQUITY', label: 'Equity' },
          { key: 'EXPENSE', label: 'Expense' },
        ],
        category_types: [],
        transaction_types: [
          { key: 'EXPENSE', label: 'Expense' },
          { key: 'INCOME', label: 'Income' },
          { key: 'TRANSFER', label: 'Transfer' },
          { key: 'ADJUSTMENT', label: 'Adjustment' },
        ],
        transaction_orders: [
          { key: 'transaction_date:desc', label: 'Newest first' },
          { key: 'transaction_date:asc', label: 'Oldest first' },
          { key: 'base_currency_amount:desc', label: 'Largest first' },
          { key: 'base_currency_amount:asc', label: 'Smallest first' },
        ],
      } satisfies components['schemas']['AccountingDictionaries']),
    ),
    http.get('http://localhost/api/accounting/accounts', ({ request }) => {
      const kinds = new URL(request.url).searchParams.getAll('kinds');
      const items = kinds.includes('ASSET')
        ? [wallet]
        : kinds.includes('EXPENSE')
          ? [category, cafes]
          : [];
      return HttpResponse.json({
        items,
        total: items.length,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']);
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  document.documentElement.removeAttribute('style');
});

test('loads the next page of the whole history when the end of the list comes into view', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/accounting/transactions', ({ request }) => {
      const searchParams = new URL(request.url).searchParams;
      const isFeedQuery =
        searchParams.get('size') === '15' &&
        searchParams.get('date_to') === '2026-10-20' &&
        !searchParams.has('date_from');
      if (!isFeedQuery) {
        return HttpResponse.json(null, { status: 400 });
      }

      return searchParams.get('page') === '1'
        ? HttpResponse.json({
            items: [expense],
            total: 2,
            page: 1,
            size: 15,
            pages: 2,
          } satisfies components['schemas']['Page_Transaction_'])
        : HttpResponse.json({
            items: [
              {
                ...expense,
                id: '5a1d9c3e-2b4f-4e6a-8c7d-9e0f1a2b3c41',
                postings: [
                  { ...walletPosting, amount: '-4.50', base_amount: '-4.50' },
                  { ...categoryPosting, amount: '4.50', base_amount: '4.50', account: cafes },
                ],
              },
            ],
            total: 2,
            page: 2,
            size: 15,
            pages: 2,
          } satisfies components['schemas']['Page_Transaction_']);
    }),
  );

  // act
  render(<Component />);

  // assert
  const transactions = await screen.findByRole('region', { name: 'Transactions' });
  expect(await within(transactions).findByText('Cafes')).toBeInTheDocument();
  expect(within(transactions).getByText('Groceries')).toBeInTheDocument();
  expect(within(transactions).getAllByRole('heading', { name: 'Today' })).toHaveLength(1);
  expect(within(transactions).getByText('-$47.30')).toBeInTheDocument();
  expect(
    screen.getByRole('heading', { level: 1, name: 'Transactions, 2 transactions' }),
  ).toBeInTheDocument();
});

test('shows a transaction moved to the next page once and the latest total', async () => {
  // arrange
  // a transaction added before page 2 loads pushes the last row of page 1 onto page 2
  server.use(
    http.get('http://localhost/api/accounting/transactions', ({ request }) =>
      new URL(request.url).searchParams.get('page') === '1'
        ? HttpResponse.json({
            items: [expense],
            total: 2,
            page: 1,
            size: 15,
            pages: 2,
          } satisfies components['schemas']['Page_Transaction_'])
        : HttpResponse.json({
            items: [
              expense,
              {
                ...expense,
                id: '5a1d9c3e-2b4f-4e6a-8c7d-9e0f1a2b3c41',
                postings: [
                  { ...walletPosting, amount: '-4.50', base_amount: '-4.50' },
                  { ...categoryPosting, amount: '4.50', base_amount: '4.50', account: cafes },
                ],
              },
            ],
            total: 3,
            page: 2,
            size: 15,
            pages: 2,
          } satisfies components['schemas']['Page_Transaction_']),
    ),
  );

  // act
  render(<Component />);

  // assert
  const transactions = await screen.findByRole('region', { name: 'Transactions' });
  expect(await within(transactions).findByText('Cafes')).toBeInTheDocument();
  expect(within(transactions).getAllByText('Groceries')).toHaveLength(1);
  expect(within(transactions).getByText('-$47.30')).toBeInTheDocument();
  expect(
    screen.getByRole('heading', { level: 1, name: 'Transactions, 3 transactions' }),
  ).toBeInTheDocument();
});

test('stops loading after the next page fails until Try again is pressed', async () => {
  // arrange
  const user = userEvent.setup();
  let nextPageRequestCount = 0;
  server.use(
    http.get('http://localhost/api/accounting/transactions', ({ request }) => {
      if (new URL(request.url).searchParams.get('page') === '1') {
        return HttpResponse.json({
          items: [expense],
          total: 2,
          page: 1,
          size: 15,
          pages: 2,
        } satisfies components['schemas']['Page_Transaction_']);
      }

      nextPageRequestCount += 1;
      return nextPageRequestCount === 1
        ? HttpResponse.json(null, { status: 400 })
        : HttpResponse.json({
            items: [
              {
                ...expense,
                id: '5a1d9c3e-2b4f-4e6a-8c7d-9e0f1a2b3c41',
                postings: [
                  { ...walletPosting, amount: '-4.50', base_amount: '-4.50' },
                  { ...categoryPosting, amount: '4.50', base_amount: '4.50', account: cafes },
                ],
              },
            ],
            total: 2,
            page: 2,
            size: 15,
            pages: 2,
          } satisfies components['schemas']['Page_Transaction_']);
    }),
  );
  render(<Component />);
  expect(await screen.findByText("Couldn't load more")).toBeInTheDocument();
  expect(nextPageRequestCount).toBe(1);

  // act
  await user.click(screen.getByRole('button', { name: 'Try again' }));

  // assert
  expect(await screen.findByText('Cafes')).toBeInTheDocument();
  expect(screen.queryByText("Couldn't load more")).not.toBeInTheDocument();
  expect(nextPageRequestCount).toBe(2);
});

test('shows the empty state without transactions', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/accounting/transactions', () =>
      HttpResponse.json({
        items: [],
        total: 0,
        page: 1,
        size: 15,
        pages: 0,
      } satisfies components['schemas']['Page_Transaction_']),
    ),
  );

  // act
  render(<Component />);

  // assert
  expect(await screen.findByText('Nothing here yet')).toBeInTheDocument();
  expect(
    screen.getByRole('heading', { level: 1, name: 'Transactions, 0 transactions' }),
  ).toBeInTheDocument();
  expect(screen.queryByRole('list')).not.toBeInTheDocument();
});

test('shows a busy list while the first page loads', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/accounting/transactions', async () => {
      await delay('infinite');
    }),
  );

  // act
  render(<Component />);

  // assert
  expect(await screen.findByRole('region', { name: 'Transactions' })).toHaveAttribute(
    'aria-busy',
    'true',
  );
  expect(screen.queryByText('Nothing here yet')).not.toBeInTheDocument();
});

test('requests the checked types and names them on the chip', async () => {
  // arrange
  const user = userEvent.setup();
  const requestedTypes: string[][] = [];
  server.use(
    http.get('http://localhost/api/accounting/transactions', ({ request }) => {
      requestedTypes.push(new URL(request.url).searchParams.getAll('transaction_types'));
      return HttpResponse.json({
        items: [expense],
        total: 1,
        page: 1,
        size: 15,
        pages: 1,
      } satisfies components['schemas']['Page_Transaction_']);
    }),
  );
  render(<Component />);
  await user.click(await screen.findByRole('button', { name: 'Type' }));
  const typeFilter = screen.getByRole('dialog', { name: 'Type' });
  await user.click(within(typeFilter).getByRole('checkbox', { name: 'Expense' }));
  await user.click(within(typeFilter).getByRole('checkbox', { name: 'Transfer' }));

  // act
  await user.click(within(typeFilter).getByRole('button', { name: 'Apply' }));

  // assert
  expect(await screen.findByRole('button', { name: 'Type: Expense +1' })).toHaveFocus();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await waitFor(() => {
    expect(requestedTypes).toEqual([[], ['EXPENSE', 'TRANSFER']]);
  });
});

test('requests the checked accounts of every kind and counts them on their chips', async () => {
  // arrange
  const user = userEvent.setup();
  const requestedAccountIds: string[][] = [];
  server.use(
    http.get('http://localhost/api/accounting/transactions', ({ request }) => {
      requestedAccountIds.push(new URL(request.url).searchParams.getAll('account_ids'));
      return HttpResponse.json({
        items: [expense],
        total: 1,
        page: 1,
        size: 15,
        pages: 1,
      } satisfies components['schemas']['Page_Transaction_']);
    }),
  );
  render(<Component />);
  await user.click(await screen.findByRole('button', { name: 'Accounts' }));
  const accountFilter = screen.getByRole('dialog', { name: 'Accounts' });
  expect(within(accountFilter).getByText('USD')).toBeInTheDocument();
  await user.click(within(accountFilter).getByRole('checkbox', { name: /Wallet/ }));
  await user.click(within(accountFilter).getByRole('button', { name: 'Apply' }));
  await user.click(await screen.findByRole('button', { name: 'Categories' }));
  const categoryFilter = screen.getByRole('dialog', { name: 'Categories' });
  await user.click(within(categoryFilter).getByRole('checkbox', { name: 'Cafes' }));

  // act
  await user.click(within(categoryFilter).getByRole('button', { name: 'Apply' }));

  // assert
  expect(await screen.findByRole('button', { name: 'Categories: Categories · 1' })).toHaveFocus();
  expect(screen.getByRole('button', { name: 'Accounts: Accounts · 1' })).toBeInTheDocument();
  await waitFor(() => {
    expect(requestedAccountIds).toEqual([[], [wallet.id], [wallet.id, cafes.id]]);
  });
});

test('clears the income sources when categories are applied', async () => {
  // arrange
  const user = userEvent.setup();
  const salary = {
    ...category,
    name: 'Salary',
    id: '2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f60',
    kind: 'INCOME',
    category_type: null,
  } satisfies components['schemas']['Account'];
  const requestedAccountIds: string[][] = [];
  server.use(
    http.get('http://localhost/api/accounting/accounts', ({ request }) => {
      const kinds = new URL(request.url).searchParams.getAll('kinds');
      const items = kinds.includes('INCOME')
        ? [salary]
        : kinds.includes('EXPENSE')
          ? [category, cafes]
          : [wallet];
      return HttpResponse.json({
        items,
        total: items.length,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']);
    }),
    http.get('http://localhost/api/accounting/transactions', ({ request }) => {
      requestedAccountIds.push(new URL(request.url).searchParams.getAll('account_ids'));
      return HttpResponse.json({
        items: [expense],
        total: 1,
        page: 1,
        size: 15,
        pages: 1,
      } satisfies components['schemas']['Page_Transaction_']);
    }),
  );
  render(<Component />, { initialEntries: [`/transactions?income_source_ids=${salary.id}`] });
  await user.click(await screen.findByRole('button', { name: 'Categories' }));
  const categoryFilter = screen.getByRole('dialog', { name: 'Categories' });
  expect(
    within(categoryFilter).getByText('Choosing categories clears the income sources filter.'),
  ).toBeInTheDocument();
  await user.click(within(categoryFilter).getByRole('checkbox', { name: 'Cafes' }));

  // act
  await user.click(within(categoryFilter).getByRole('button', { name: 'Apply' }));

  // assert
  expect(await screen.findByRole('button', { name: 'Categories: Categories · 1' })).toHaveFocus();
  expect(screen.getByRole('button', { name: 'Income sources: Income' })).toBeInTheDocument();
  await waitFor(() => {
    expect(requestedAccountIds).toEqual([[salary.id], [cafes.id]]);
  });
});

test('drops the income sources of a URL that also has categories', async () => {
  // arrange
  const salary = {
    ...category,
    name: 'Salary',
    id: '2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f60',
    kind: 'INCOME',
    category_type: null,
  } satisfies components['schemas']['Account'];
  const requestedAccountIds: string[][] = [];
  server.use(
    http.get('http://localhost/api/accounting/accounts', ({ request }) => {
      const kinds = new URL(request.url).searchParams.getAll('kinds');
      const items = kinds.includes('INCOME')
        ? [salary]
        : kinds.includes('EXPENSE')
          ? [category, cafes]
          : [wallet];
      return HttpResponse.json({
        items,
        total: items.length,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']);
    }),
    http.get('http://localhost/api/accounting/transactions', ({ request }) => {
      requestedAccountIds.push(new URL(request.url).searchParams.getAll('account_ids'));
      return HttpResponse.json({
        items: [expense],
        total: 1,
        page: 1,
        size: 15,
        pages: 1,
      } satisfies components['schemas']['Page_Transaction_']);
    }),
  );

  // act
  render(<Component />, {
    initialEntries: [`/transactions?category_ids=${cafes.id}&income_source_ids=${salary.id}`],
  });

  // assert
  expect(
    await screen.findByRole('button', { name: 'Categories: Categories · 1' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Income sources: Income' })).toBeInTheDocument();
  expect(requestedAccountIds).toEqual([[cafes.id]]);
});

test('loads the list without waiting for the accounts when no account is filtered', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/accounting/accounts', async () => {
      await delay('infinite');
      return HttpResponse.json(null);
    }),
    http.get('http://localhost/api/accounting/transactions', () =>
      HttpResponse.json({
        items: [expense],
        total: 1,
        page: 1,
        size: 15,
        pages: 1,
      } satisfies components['schemas']['Page_Transaction_']),
    ),
  );

  // act
  render(<Component />);

  // assert
  expect(await screen.findByText('Groceries')).toBeInTheDocument();
  expect(screen.queryByRole('group', { name: 'Filters' })).not.toBeInTheDocument();
});

test('shows a note instead of the list for a kind without accounts', async () => {
  // arrange
  const user = userEvent.setup();
  server.use(
    http.get('http://localhost/api/accounting/transactions', () =>
      HttpResponse.json({
        items: [expense],
        total: 1,
        page: 1,
        size: 15,
        pages: 1,
      } satisfies components['schemas']['Page_Transaction_']),
    ),
  );
  render(<Component />);

  // act
  await user.click(await screen.findByRole('button', { name: 'Income sources: Income' }));

  // assert
  const incomeSourceFilter = screen.getByRole('dialog', { name: 'Income sources' });
  expect(within(incomeSourceFilter).getByText('No income sources yet.')).toBeInTheDocument();
  expect(
    within(incomeSourceFilter).queryByRole('button', { name: 'Apply' }),
  ).not.toBeInTheDocument();
});

test('requests the period typed in its dates', async () => {
  // arrange
  const user = userEvent.setup();
  const requestedPeriods: (string | null)[][] = [];
  server.use(
    http.get('http://localhost/api/accounting/transactions', ({ request }) => {
      const searchParams = new URL(request.url).searchParams;
      requestedPeriods.push([searchParams.get('date_from'), searchParams.get('date_to')]);
      return HttpResponse.json({
        items: [expense],
        total: 1,
        page: 1,
        size: 15,
        pages: 1,
      } satisfies components['schemas']['Page_Transaction_']);
    }),
  );
  render(<Component />);
  await user.click(await screen.findByRole('button', { name: 'Period' }));
  const periodFilter = screen.getByRole('dialog', { name: 'Period' });
  await user.type(within(periodFilter).getByLabelText('From'), '01102026');

  // act
  await user.click(within(periodFilter).getByRole('button', { name: 'Apply' }));

  // assert
  expect(
    await screen.findByRole('button', { name: 'Period: From 01.10.2026' }),
  ).toBeInTheDocument();
  await waitFor(() => {
    expect(requestedPeriods).toEqual([
      [null, '2026-10-20'],
      ['2026-10-01', '2026-10-20'],
    ]);
  });
});

test('keeps the amount filter open on an invalid amount', async () => {
  // arrange
  const user = userEvent.setup();
  server.use(
    http.get('http://localhost/api/accounting/transactions', () =>
      HttpResponse.json({
        items: [expense],
        total: 1,
        page: 1,
        size: 15,
        pages: 1,
      } satisfies components['schemas']['Page_Transaction_']),
    ),
  );
  render(<Component />);
  await user.click(await screen.findByRole('button', { name: 'Amount' }));
  const amountFilter = screen.getByRole('dialog', { name: 'Amount' });
  await user.type(within(amountFilter).getByLabelText('From, USD'), '500');
  await user.type(within(amountFilter).getByLabelText('To, USD'), '1.234');

  // act
  await user.click(within(amountFilter).getByRole('button', { name: 'Apply' }));

  // assert
  expect(
    await within(amountFilter).findByText('Enter an amount such as 100 or 99.50.'),
  ).toBeInTheDocument();
  expect(within(amountFilter).getByLabelText('To, USD')).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByRole('button', { name: 'Amount' })).toBeInTheDocument();
});

test('shows the rows without days and with their dates when sorted by amount', async () => {
  // arrange
  const user = userEvent.setup();
  server.use(
    http.get('http://localhost/api/accounting/transactions', ({ request }) => {
      const isAmountOrder =
        new URL(request.url).searchParams.get('orders') === 'base_currency_amount:desc';
      return HttpResponse.json({
        items: isAmountOrder ? [expense] : [],
        total: isAmountOrder ? 1 : 0,
        page: 1,
        size: 15,
        pages: isAmountOrder ? 1 : 0,
      } satisfies components['schemas']['Page_Transaction_']);
    }),
  );
  render(<Component />);
  await user.click(await screen.findByRole('button', { name: 'Sort: Newest first' }));

  // act
  await user.click(screen.getByRole('button', { name: /^Largest first/ }));

  // assert
  const transactions = await screen.findByRole('region', { name: 'Transactions' });
  expect(await within(transactions).findByText('Groceries')).toBeInTheDocument();
  expect(within(transactions).getByText('Today')).toBeInTheDocument();
  expect(within(transactions).queryByRole('heading')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Sort: Largest first' })).toBeInTheDocument();
});

test('resets the filters that match nothing', async () => {
  // arrange
  const user = userEvent.setup();
  server.use(
    http.get('http://localhost/api/accounting/transactions', ({ request }) => {
      const isFiltered = new URL(request.url).searchParams.has('base_currency_amount_from');
      return HttpResponse.json({
        items: isFiltered ? [] : [expense],
        total: isFiltered ? 0 : 1,
        page: 1,
        size: 15,
        pages: isFiltered ? 0 : 1,
      } satisfies components['schemas']['Page_Transaction_']);
    }),
  );
  render(<Component />, {
    initialEntries: ['/transactions?base_currency_amount_from=5000&transaction_types=TRANSFER'],
  });
  expect(await screen.findByText('Nothing matches these filters')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Amount: Over $5,000' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Type: Transfer' })).toBeInTheDocument();

  // act
  await user.click(screen.getByRole('button', { name: 'Reset filters' }));

  // assert
  expect(await screen.findByText('Groceries')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Amount' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Type' })).toBeInTheDocument();
});

test('drops the filters of the URL that are not valid', async () => {
  // arrange
  let requestedSearch = '';
  server.use(
    http.get('http://localhost/api/accounting/transactions', ({ request }) => {
      requestedSearch = new URL(request.url).search;
      return HttpResponse.json({
        items: [expense],
        total: 1,
        page: 1,
        size: 15,
        pages: 1,
      } satisfies components['schemas']['Page_Transaction_']);
    }),
  );

  // act
  render(<Component />, {
    initialEntries: [
      '/transactions?date_from=2026-11-01&date_to=2026-10-10&transaction_types=LOAN&transaction_types=INCOME&base_currency_amount_to=0&order=name:desc&account_ids=wallet&account_ids=0f0e0d0c-0b0a-4908-8706-050403020100&category_ids=1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f',
    ],
  });

  // assert
  expect(await screen.findByText('Groceries')).toBeInTheDocument();
  expect(requestedSearch).toBe(
    '?transaction_types=INCOME&account_ids=1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f&size=15&date_to=2026-10-20&page=1',
  );
});

test('closes a filter without applying it on a press outside', async () => {
  // arrange
  const user = userEvent.setup();
  server.use(
    http.get('http://localhost/api/accounting/transactions', () =>
      HttpResponse.json({
        items: [expense],
        total: 1,
        page: 1,
        size: 15,
        pages: 1,
      } satisfies components['schemas']['Page_Transaction_']),
    ),
  );
  render(<Component />);
  await user.click(await screen.findByRole('button', { name: 'Type' }));
  await user.click(
    within(screen.getByRole('dialog', { name: 'Type' })).getByRole('checkbox', { name: 'Income' }),
  );

  // act
  await user.click(screen.getByRole('heading', { level: 1 }));

  // assert
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Type' })).toBeInTheDocument();
});

test('clears the typed amounts on Reset', async () => {
  // arrange
  const user = userEvent.setup();
  server.use(
    http.get('http://localhost/api/accounting/transactions', () =>
      HttpResponse.json({
        items: [expense],
        total: 1,
        page: 1,
        size: 15,
        pages: 1,
      } satisfies components['schemas']['Page_Transaction_']),
    ),
  );
  render(<Component />, { initialEntries: ['/transactions?base_currency_amount_from=100'] });
  await user.click(await screen.findByRole('button', { name: 'Amount: Over $100' }));
  const amountFilter = screen.getByRole('dialog', { name: 'Amount' });
  await user.type(within(amountFilter).getByLabelText('To, USD'), '500');

  // act
  await user.click(within(amountFilter).getByRole('button', { name: 'Reset' }));

  // assert
  expect(within(amountFilter).getByLabelText('From, USD')).toHaveValue('');
  expect(within(amountFilter).getByLabelText('To, USD')).toHaveValue('');
});

test('opens a recent month with one request and keeps the newer days above it', async () => {
  // arrange
  const user = userEvent.setup();
  const requestedSearches: string[] = [];
  server.use(
    http.get('http://localhost/api/accounting/transactions', ({ request }) => {
      const searchParams = new URL(request.url).searchParams;
      requestedSearches.push(searchParams.toString());
      const isMonthQuery = searchParams.get('date_to') === '2026-09-30';
      const isNewerQuery = searchParams.get('orders') === 'transaction_date:asc';
      return HttpResponse.json({
        items: isMonthQuery
          ? [
              {
                ...expense,
                id: '5a1d9c3e-2b4f-4e6a-8c7d-9e0f1a2b3c41',
                transaction_date: '2026-09-14',
                postings: [walletPosting, { ...categoryPosting, account: cafes }],
              },
            ]
          : [expense],
        total: 1,
        page: 1,
        size: 15,
        pages: isNewerQuery || isMonthQuery ? 1 : 3,
      } satisfies components['schemas']['Page_Transaction_']);
    }),
  );
  const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView');
  render(<Component />);
  await user.click(await screen.findByRole('button', { name: 'Period' }));

  // act
  await user.click(
    within(screen.getByRole('dialog', { name: 'Period' })).getByRole('button', {
      name: 'September',
    }),
  );

  // assert
  const septemberDay = await screen.findByRole('heading', { name: 'Mon, 14.09.2026' });
  expect(await screen.findByRole('heading', { name: 'Today' })).toBeInTheDocument();
  expect(
    scrollIntoView.mock.contexts.some(
      (scrolledElement) =>
        scrolledElement instanceof Element && scrolledElement.contains(septemberDay),
    ),
  ).toBe(true);
  expect(
    screen.getByRole('heading', { level: 1, name: 'Transactions, 2 transactions' }),
  ).toBeInTheDocument();
  expect(requestedSearches).toContain('size=15&date_to=2026-09-30&page=1');
  expect(requestedSearches).toContain(
    'size=15&date_from=2026-10-01&date_to=2026-10-20&orders=transaction_date%3Aasc&page=1',
  );
});

test('opens the To date with one request', async () => {
  // arrange
  const user = userEvent.setup();
  const requestedDateTos: (string | null)[] = [];
  server.use(
    http.get('http://localhost/api/accounting/transactions', ({ request }) => {
      const searchParams = new URL(request.url).searchParams;
      if (searchParams.get('orders') === null) {
        requestedDateTos.push(searchParams.get('date_to'));
      }

      return HttpResponse.json({
        items: [expense],
        total: 1,
        page: 1,
        size: 15,
        pages: 1,
      } satisfies components['schemas']['Page_Transaction_']);
    }),
  );
  render(<Component />);
  await user.click(await screen.findByRole('button', { name: 'Period' }));
  const periodFilter = screen.getByRole('dialog', { name: 'Period' });
  await user.clear(within(periodFilter).getByLabelText('To'));
  await user.type(within(periodFilter).getByLabelText('To'), '01032024');

  // act
  await user.click(within(periodFilter).getByRole('button', { name: 'Apply' }));

  // assert
  await waitFor(() => {
    expect(requestedDateTos).toEqual(['2026-10-20', '2024-03-01']);
  });
  expect(screen.getByRole('button', { name: 'Period' })).toBeInTheDocument();
});

test('keeps the period open on a date that does not exist', async () => {
  // arrange
  const user = userEvent.setup();
  server.use(
    http.get('http://localhost/api/accounting/transactions', () =>
      HttpResponse.json({
        items: [expense],
        total: 1,
        page: 1,
        size: 15,
        pages: 1,
      } satisfies components['schemas']['Page_Transaction_']),
    ),
  );
  render(<Component />);
  await user.click(await screen.findByRole('button', { name: 'Period' }));
  const periodFilter = screen.getByRole('dialog', { name: 'Period' });
  await user.type(within(periodFilter).getByLabelText('From'), '30022026');

  // act
  await user.click(within(periodFilter).getByRole('button', { name: 'Apply' }));

  // assert
  expect(within(periodFilter).getByLabelText('From')).toHaveValue('30.02.2026');
  expect(await within(periodFilter).findByText('Enter a date as dd.mm.yyyy.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Period' })).toBeInTheDocument();
});

test('shows a retry above the month when its newer days fail to load', async () => {
  // arrange
  const user = userEvent.setup();
  let newerRequestCount = 0;
  server.use(
    http.get('http://localhost/api/accounting/transactions', ({ request }) => {
      const searchParams = new URL(request.url).searchParams;
      if (searchParams.get('orders') === 'transaction_date:asc') {
        newerRequestCount += 1;
        if (newerRequestCount === 1) {
          return HttpResponse.json(null, { status: 500 });
        }
      }

      return HttpResponse.json({
        items:
          searchParams.get('date_to') === '2026-09-30'
            ? [
                {
                  ...expense,
                  id: '5a1d9c3e-2b4f-4e6a-8c7d-9e0f1a2b3c41',
                  transaction_date: '2026-09-14',
                  postings: [walletPosting, { ...categoryPosting, account: cafes }],
                },
              ]
            : [expense],
        total: 1,
        page: 1,
        size: 15,
        pages: 1,
      } satisfies components['schemas']['Page_Transaction_']);
    }),
  );
  render(<Component />);
  await user.click(await screen.findByRole('button', { name: 'Period' }));
  await user.click(
    within(screen.getByRole('dialog', { name: 'Period' })).getByRole('button', {
      name: 'September',
    }),
  );
  expect(await screen.findByText("Couldn't load newer")).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Today' })).not.toBeInTheDocument();

  // act
  await user.click(screen.getByRole('button', { name: 'Try again' }));

  // assert
  expect(await screen.findByRole('heading', { name: 'Today' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Mon, 14.09.2026' })).toBeInTheDocument();
  expect(screen.queryByText("Couldn't load newer")).not.toBeInTheDocument();
  expect(newerRequestCount).toBe(2);
});

test('keeps the period open on a date after today', async () => {
  // arrange
  const user = userEvent.setup();
  server.use(
    http.get('http://localhost/api/accounting/transactions', () =>
      HttpResponse.json({
        items: [expense],
        total: 1,
        page: 1,
        size: 15,
        pages: 1,
      } satisfies components['schemas']['Page_Transaction_']),
    ),
  );
  render(<Component />);
  await user.click(await screen.findByRole('button', { name: 'Period' }));
  const periodFilter = screen.getByRole('dialog', { name: 'Period' });
  await user.type(within(periodFilter).getByLabelText('From'), '01122026');

  // act
  await user.click(within(periodFilter).getByRole('button', { name: 'Apply' }));

  // assert
  expect(
    await within(periodFilter).findByText('Pick a date no later than today.'),
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Period' })).toBeInTheDocument();
});

test('shows the selected transaction with its postings, location and comment', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/accounting/transactions', () =>
      HttpResponse.json({
        items: [expense],
        total: 1,
        page: 1,
        size: 15,
        pages: 1,
      } satisfies components['schemas']['Page_Transaction_']),
    ),
    http.get(`http://localhost/api/accounting/transactions/${expense.id}`, () =>
      HttpResponse.json({
        ...expense,
        comment: 'Weekly shop',
        location: {
          name: 'Tbilisi',
          user_id: expense.user_id,
          id: '6b7c8d9e-0f1a-4b2c-9d3e-4f5a6b7c8d9e',
          status: 'ACTIVE',
          created_at: '2026-10-01T09:00:00Z',
          updated_at: '2026-10-01T09:00:00Z',
        },
        base_currency_amount: '46.70',
        postings: [
          { ...walletPosting, amount: '-42.80', currency: 'EUR', base_amount: '-46.70' },
          { ...categoryPosting, amount: '42.80', currency: 'EUR', base_amount: '46.70' },
        ],
      } satisfies components['schemas']['Transaction']),
    ),
  );

  // act
  render(<Component />, { initialEntries: [`/transactions?transaction=${expense.id}`] });

  // assert
  const details = await screen.findByRole('dialog', { name: 'Transaction details' });
  expect(
    await within(details).findByRole('heading', { level: 2, name: 'Groceries' }),
  ).toBeInTheDocument();
  expect(within(details).getByText('Expense · Tue, 20.10.2026')).toBeInTheDocument();
  // the amount of the transaction and of its Wallet posting
  expect(within(details).getAllByText('-€42.80')).toHaveLength(2);
  expect(within(details).getByText('≈ $46.70')).toBeInTheDocument();
  // each posting: its account, kind and currency, amount and base-currency value
  const postings = within(details).getAllByRole('listitem');
  expect(postings[0]).toHaveTextContent('WalletAsset · USD-€42.80≈ -$46.70');
  expect(postings[1]).toHaveTextContent('GroceriesExpense+€42.80≈ +$46.70');
  expect(within(details).getByText('Tbilisi')).toBeInTheDocument();
  expect(within(details).getByText('Weekly shop')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Groceries' })).toHaveAttribute('aria-current', 'true');
});

test('opens the details of a row and closes them', async () => {
  // arrange
  const user = userEvent.setup();
  let feedRequestCount = 0;
  server.use(
    http.get('http://localhost/api/accounting/transactions', () => {
      feedRequestCount += 1;
      return HttpResponse.json({
        items: [expense],
        total: 1,
        page: 1,
        size: 15,
        pages: 1,
      } satisfies components['schemas']['Page_Transaction_']);
    }),
    http.get(`http://localhost/api/accounting/transactions/${expense.id}`, () =>
      HttpResponse.json(expense),
    ),
  );
  render(<Component />);
  await user.click(await screen.findByRole('link', { name: 'Groceries' }));
  const details = await screen.findByRole('dialog', { name: 'Transaction details' });
  expect(
    await within(details).findByRole('heading', { level: 2, name: 'Groceries' }),
  ).toBeInTheDocument();

  // act
  await user.click(within(details).getByRole('button', { name: 'Close details' }));

  // assert
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Groceries' })).toHaveFocus();
  expect(feedRequestCount).toBe(1);
});

test('deletes the transaction after the confirmation and refreshes the list and the accounts', async () => {
  // arrange
  const user = userEvent.setup();
  let isDeleted = false;
  let deletedType: string | null = null;
  let accountRequestCount = 0;
  let detailRequestCount = 0;
  server.use(
    http.get('http://localhost/api/accounting/transactions', () =>
      HttpResponse.json({
        items: isDeleted ? [] : [expense],
        total: isDeleted ? 0 : 1,
        page: 1,
        size: 15,
        pages: isDeleted ? 0 : 1,
      } satisfies components['schemas']['Page_Transaction_']),
    ),
    http.get(`http://localhost/api/accounting/transactions/${expense.id}`, () => {
      detailRequestCount += 1;
      return HttpResponse.json(expense);
    }),
    http.delete(`http://localhost/api/accounting/transactions/${expense.id}`, ({ request }) => {
      isDeleted = true;
      deletedType = new URL(request.url).searchParams.get('transaction_type');
      return HttpResponse.json(expense);
    }),
    http.get('http://localhost/api/accounting/accounts', () => {
      accountRequestCount += 1;
      return HttpResponse.json({
        items: [],
        total: 0,
        page: 1,
        size: 100,
        pages: 0,
      } satisfies components['schemas']['Page_Account_']);
    }),
  );
  render(<Component />, { initialEntries: [`/transactions?transaction=${expense.id}`] });
  const details = await screen.findByRole('dialog', { name: 'Transaction details' });
  await user.click(await within(details).findByRole('button', { name: 'Delete transaction' }));
  const confirmation = screen.getByRole('alertdialog', { name: 'Delete this transaction?' });
  expect(confirmation).toHaveAccessibleDescription(
    "Groceries, -$42.80 on 20.10.2026. The balances of Wallet and Groceries are recalculated. This can't be undone.",
  );
  const accountRequestsBeforeDelete = accountRequestCount;

  // act
  await user.click(within(confirmation).getByRole('button', { name: 'Delete' }));

  // assert
  expect(await screen.findByText('Nothing here yet')).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(deletedType).toBe('EXPENSE');
  expect(accountRequestCount).toBeGreaterThan(accountRequestsBeforeDelete);
  expect(detailRequestCount).toBe(1);
});

test('keeps the details open when the deletion is cancelled with Escape', async () => {
  // arrange
  const user = userEvent.setup();
  server.use(
    http.get('http://localhost/api/accounting/transactions', () =>
      HttpResponse.json({
        items: [expense],
        total: 1,
        page: 1,
        size: 15,
        pages: 1,
      } satisfies components['schemas']['Page_Transaction_']),
    ),
    http.get(`http://localhost/api/accounting/transactions/${expense.id}`, () =>
      HttpResponse.json(expense),
    ),
  );
  render(<Component />, { initialEntries: [`/transactions?transaction=${expense.id}`] });
  const details = await screen.findByRole('dialog', { name: 'Transaction details' });
  await user.click(await within(details).findByRole('button', { name: 'Delete transaction' }));

  // act
  await user.keyboard('{Escape}');

  // assert
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(screen.getByRole('dialog', { name: 'Transaction details' })).toBeInTheDocument();
  expect(within(details).getByRole('button', { name: 'Delete transaction' })).toHaveFocus();
});

test('keeps the details open when Escape closes a filter', async () => {
  // arrange
  const user = userEvent.setup();
  server.use(
    http.get('http://localhost/api/accounting/transactions', () =>
      HttpResponse.json({
        items: [expense],
        total: 1,
        page: 1,
        size: 15,
        pages: 1,
      } satisfies components['schemas']['Page_Transaction_']),
    ),
    http.get(`http://localhost/api/accounting/transactions/${expense.id}`, () =>
      HttpResponse.json(expense),
    ),
  );
  render(<Component />, { initialEntries: [`/transactions?transaction=${expense.id}`] });
  expect(await screen.findByRole('heading', { level: 2, name: 'Groceries' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Amount' }));
  expect(screen.getByRole('dialog', { name: 'Amount' })).toBeInTheDocument();

  // act
  await user.keyboard('{Escape}');

  // assert
  expect(screen.queryByRole('dialog', { name: 'Amount' })).not.toBeInTheDocument();
  expect(screen.getByRole('dialog', { name: 'Transaction details' })).toBeInTheDocument();
});

test('leaves the adjustment account out of the balances the deletion recalculates', async () => {
  // arrange
  const user = userEvent.setup();
  const adjustment = {
    ...expense,
    transaction_type: 'ADJUSTMENT',
    postings: [
      {
        ...categoryPosting,
        amount: '-12.00',
        base_amount: '-12.00',
        account: { ...category, name: 'Adjustments', kind: 'EQUITY', category_type: null },
      },
      { ...walletPosting, amount: '12.00', base_amount: '12.00' },
    ],
  } satisfies components['schemas']['Transaction'];
  server.use(
    http.get('http://localhost/api/accounting/transactions', () =>
      HttpResponse.json({
        items: [adjustment],
        total: 1,
        page: 1,
        size: 15,
        pages: 1,
      } satisfies components['schemas']['Page_Transaction_']),
    ),
    http.get(`http://localhost/api/accounting/transactions/${expense.id}`, () =>
      HttpResponse.json(adjustment),
    ),
  );
  render(<Component />, {
    initialEntries: [`/transactions?transaction=${expense.id}`],
  });
  const details = await screen.findByRole('dialog', { name: 'Transaction details' });

  // act
  await user.click(await within(details).findByRole('button', { name: 'Delete transaction' }));

  // assert
  expect(
    screen.getByRole('alertdialog', { name: 'Delete this transaction?' }),
  ).toHaveAccessibleDescription(
    "Adjustment · Wallet, +$12.00 on 20.10.2026. The balance of Wallet is recalculated. This can't be undone.",
  );
});

test('closes the details of a transaction that another tab deleted', async () => {
  // arrange
  const user = userEvent.setup();
  const otherTab = new BroadcastChannel('finance-data-change');
  onTestFinished(() => {
    otherTab.close();
  });
  let isDeleted = false;
  server.use(
    http.get('http://localhost/api/accounting/transactions', () =>
      HttpResponse.json({
        items: isDeleted ? [] : [expense],
        total: isDeleted ? 0 : 1,
        page: 1,
        size: 15,
        pages: 1,
      } satisfies components['schemas']['Page_Transaction_']),
    ),
    http.get(`http://localhost/api/accounting/transactions/${expense.id}`, () =>
      isDeleted
        ? HttpResponse.json(
            { error_code: 'NOT_FOUND', message: 'Transaction not found' },
            { status: 404 },
          )
        : HttpResponse.json(expense),
    ),
  );
  render(<Component />);
  await user.click(await screen.findByRole('link', { name: 'Groceries' }));
  const details = await screen.findByRole('dialog', { name: 'Transaction details' });
  expect(
    await within(details).findByRole('heading', { level: 2, name: 'Groceries' }),
  ).toBeInTheDocument();
  isDeleted = true;

  // act
  otherTab.postMessage(null);

  // assert
  await waitFor(() => {
    expect(screen.queryByRole('dialog', { name: 'Transaction details' })).not.toBeInTheDocument();
  });
  expect(screen.queryByText('Something went wrong. Please try again.')).not.toBeInTheDocument();
});
