import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { afterEach, beforeEach, expect, onTestFinished, test, vi } from 'vitest';

import type { components } from '@/lib/api-schema';
import { render } from '@/test/render';
import { server } from '@/test/setup';

import { Component } from './home';

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
  postings: [
    {
      id: '3e4f5a6b-7c8d-4e9f-8a0b-1c2d3e4f5a60',
      amount: '-42.80',
      currency: 'USD',
      base_amount: '-42.80',
      account: wallet,
    },
    {
      id: '3e4f5a6b-7c8d-4e9f-8a0b-1c2d3e4f5a61',
      amount: '42.80',
      currency: 'USD',
      base_amount: '42.80',
      account: {
        ...wallet,
        name: 'Groceries',
        id: '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f',
        kind: 'EXPENSE',
        currency: null,
        category_type: 'VARIABLE',
      },
    },
  ],
} satisfies components['schemas']['Transaction'];

const income = {
  id: '5a1d9c3e-2b4f-4e6a-8c7d-9e0f1a2b3c4d',
  user_id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
  transaction_date: '2026-03-02',
  comment: null,
  base_currency_amount: '640.00',
  location: null,
  income_period: '2026-03-01',
  transaction_type: 'INCOME',
  status: 'ACTIVE',
  created_at: '2026-10-14T09:00:00Z',
  updated_at: '2026-10-14T09:00:00Z',
  postings: [
    {
      id: '9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b61',
      amount: '-640.00',
      currency: 'USD',
      base_amount: '-640.00',
      account: {
        name: 'Design project',
        id: '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f',
        user_id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
        kind: 'INCOME',
        balance: '0',
        currency: null,
        color: null,
        category_type: null,
        base_currency_rate: '0',
        status: 'ACTIVE',
        base_currency_balance: '0.00',
      },
    },
    {
      id: '9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b62',
      amount: '640.00',
      currency: 'USD',
      base_amount: '640.00',
      account: {
        name: 'Freelance',
        id: '7f0c2f4e-8c1a-4b9e-9d1f-0e6a3c2b1a01',
        user_id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
        kind: 'ASSET',
        balance: '1940.00',
        currency: 'USD',
        color: '#A15CB8',
        category_type: null,
        base_currency_rate: '1',
        status: 'ACTIVE',
        base_currency_balance: '1940.00',
      },
    },
  ],
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
          { key: 'EXPENSE', label: 'Expense' },
        ],
        category_types: [
          { key: 'VARIABLE', label: 'Variable' },
          { key: 'FIXED', label: 'Fixed' },
          { key: 'PERIODIC', label: 'Periodic' },
        ],
        transaction_types: [{ key: 'EXPENSE', label: 'Expense' }],
        transaction_orders: [],
      } satisfies components['schemas']['AccountingDictionaries']),
    ),
    http.get('http://localhost/api/accounting/accounts', ({ request }) =>
      new URL(request.url).searchParams.get('order') === 'recent_use'
        ? HttpResponse.json({
            items: [wallet],
            total: 1,
            page: 1,
            size: 100,
            pages: 1,
          } satisfies components['schemas']['Page_Account_'])
        : HttpResponse.json(null, { status: 400 }),
    ),
    http.get('http://localhost/api/accounting/summary', () =>
      HttpResponse.json({
        month: '2026-10-01',
        total_balance: '412.50',
        estimated_total_balance: null,
        earned: '0.00',
        spent: '42.80',
        left_over: '-42.80',
        unvalued_spent: [],
        estimated_unvalued_spent: null,
        estimate_rates: [],
      } satisfies components['schemas']['Summary']),
    ),
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
    // the details of the top transaction and of its first money account, which show by default
    http.get('http://localhost/api/accounting/transactions/:transactionId', ({ params }) =>
      HttpResponse.json({
        ...expense,
        id: String(params['transactionId']),
      } satisfies components['schemas']['Transaction']),
    ),
    http.get('http://localhost/api/accounting/accounts/:accountId', ({ params }) =>
      HttpResponse.json({
        ...wallet,
        id: String(params['accountId']),
      } satisfies components['schemas']['Account']),
    ),
  );
});

afterEach(() => {
  vi.useRealTimers();
  document.documentElement.removeAttribute('style');
});

test('hides Recent when the accounting dictionary fails to load', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/dictionaries/accounting', () =>
      HttpResponse.json(null, { status: 500 }),
    ),
  );

  // act
  render(<Component />);

  // assert
  expect(await screen.findByRole('region', { name: 'Accounts' })).toBeInTheDocument();
  await vi.waitFor(() => {
    expect(screen.queryByRole('region', { name: 'Recent transactions' })).not.toBeInTheDocument();
  });
});

test('shows the first account and the top recent transaction while none is chosen', async () => {
  // arrange
  const user = userEvent.setup();
  server.use(
    http.get(`http://localhost/api/accounting/accounts/${wallet.id}`, () =>
      HttpResponse.json(wallet),
    ),
  );

  // act
  render(<Component />);

  // assert
  const details = await screen.findByRole('dialog', { name: 'Transaction details' });
  expect(
    await within(details).findByRole('heading', { level: 2, name: 'Groceries' }),
  ).toBeInTheDocument();
  expect(details).not.toHaveFocus();
  const accountDetails = await screen.findByRole('dialog', { name: 'Account details' });
  expect(
    await within(accountDetails).findByRole('heading', { level: 2, name: 'Wallet' }),
  ).toBeInTheDocument();
  expect(accountDetails).not.toHaveFocus();
  expect(within(accountDetails).getByRole('link', { name: 'Adjust balance' })).toHaveAttribute(
    'href',
    `/?new_transaction=ADJUSTMENT&new_transaction_account=${wallet.id}`,
  );
  expect(within(accountDetails).getByRole('link', { name: 'Transactions' })).toHaveAttribute(
    'href',
    `/transactions?account_ids=${wallet.id}`,
  );
  expect(within(accountDetails).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  const deleteButton = within(accountDetails).getByRole('button', { name: 'Delete account' });
  expect(deleteButton).toHaveAttribute('aria-disabled', 'true');
  await user.hover(deleteButton);
  expect(screen.getByRole('tooltip')).toHaveTextContent('Bring the balance to zero to delete.');
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  expect(accountDetails).toBeInTheDocument();
  expect(details).toBeInTheDocument();
});

test('shows the framed transaction skeleton before Recent answers and keeps it until the details do', async () => {
  // arrange
  let answerFeed = (): void => undefined;
  const feedAnswered = new Promise<void>((resolve) => {
    answerFeed = resolve;
  });
  let answerDetails = (): void => undefined;
  const detailsAnswered = new Promise<void>((resolve) => {
    answerDetails = resolve;
  });
  server.use(
    http.get('http://localhost/api/accounting/transactions', async () => {
      await feedAnswered;
      return HttpResponse.json({
        items: [expense],
        total: 1,
        page: 1,
        size: 15,
        pages: 1,
      } satisfies components['schemas']['Page_Transaction_']);
    }),
    http.get(`http://localhost/api/accounting/transactions/${expense.id}`, async () => {
      await detailsAnswered;
      return HttpResponse.json(expense);
    }),
  );

  // act
  render(<Component />);

  // assert
  // the labels of an expense stand in a busy card while the feed loads
  const details = await screen.findByRole('dialog', { name: 'Transaction details' });
  expect(details).toHaveAttribute('aria-busy', 'true');
  expect(within(details).getByText('From')).toBeInTheDocument();
  expect(within(details).getByText('Comment')).toBeInTheDocument();

  // act
  answerFeed();

  // assert
  const recentTransactions = await screen.findByRole('region', { name: 'Recent transactions' });
  expect(
    await within(recentTransactions).findByRole('link', { name: 'Groceries' }),
  ).toBeInTheDocument();
  expect(details).toHaveAttribute('aria-busy', 'true');
  expect(within(details).queryByRole('heading', { level: 2 })).not.toBeInTheDocument();

  // act
  answerDetails();

  // assert
  expect(
    await within(details).findByRole('heading', { level: 2, name: 'Groceries' }),
  ).toBeInTheDocument();
  expect(details).toHaveAttribute('aria-busy', 'false');
});

test('opens the details of a recent transaction on Home', async () => {
  // arrange
  const user = userEvent.setup();
  render(<Component />);
  const recentTransactions = await screen.findByRole('region', { name: 'Recent transactions' });

  // act
  await user.click(await within(recentTransactions).findByRole('link', { name: 'Groceries' }));

  // assert
  const details = await screen.findByRole('dialog', { name: 'Transaction details' });
  expect(
    await within(details).findByRole('heading', { level: 2, name: 'Groceries' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 1, name: 'Home' })).toBeInTheDocument();
  expect(within(recentTransactions).getByRole('link', { name: 'Groceries' })).toHaveAttribute(
    'aria-current',
    'true',
  );
});

test('opens an account from its card on Home and links the strip to the Accounts section', async () => {
  // arrange
  const user = userEvent.setup();
  server.use(
    http.get(`http://localhost/api/accounting/accounts/${wallet.id}`, () =>
      HttpResponse.json(wallet),
    ),
  );
  render(<Component />);
  const accounts = await screen.findByRole('region', { name: 'Accounts' });

  // act
  await user.click(await within(accounts).findByRole('link', { name: /^Wallet/ }));

  // assert
  const details = await screen.findByRole('dialog', { name: 'Account details' });
  expect(await within(details).findByRole('heading', { name: 'Wallet' })).toBeInTheDocument();
  expect(within(accounts).getByRole('link', { name: /^Wallet/ })).toHaveAttribute(
    'aria-current',
    'true',
  );
  expect(within(accounts).getByRole('link', { name: 'All' })).toHaveAttribute('href', '/accounts');
});

test('opens the account of a posting on Home in place of the card under the chosen account', async () => {
  // arrange
  const user = userEvent.setup();
  server.use(
    http.get(`http://localhost/api/accounting/accounts/${wallet.id}`, () =>
      HttpResponse.json(wallet),
    ),
  );
  render(<Component />, { initialEntries: [`/?account=${wallet.id}&transaction=${expense.id}`] });
  const details = await screen.findByRole('dialog', { name: 'Transaction details' });
  const accountLink = await within(details).findByRole('link', { name: 'Wallet' });

  // act
  await user.click(accountLink);

  // assert
  expect(accountLink).toHaveAttribute(
    'href',
    `/?account=${wallet.id}&transaction=${expense.id}&entry=account.${wallet.id}`,
  );
  expect(await screen.findByRole('link', { name: 'Transaction' })).toBeInTheDocument();
  // the account chosen in the list stays above the account opened from the card
  expect(screen.getAllByRole('dialog', { name: 'Account details' })).toHaveLength(2);
  expect(screen.queryByRole('dialog', { name: 'Transaction details' })).not.toBeInTheDocument();
});

test.each([
  { region: 'Accounts', link: /^Wallet/, panel: 'Account details', heading: 'Wallet' },
  {
    region: 'Recent transactions',
    link: /^Groceries/,
    panel: 'Transaction details',
    heading: 'Groceries',
  },
])(
  'dismisses and reopens $panel on Home after a swipe',
  async ({ region, link, panel, heading }) => {
    // arrange
    const user = userEvent.setup();
    render(<Component />);
    const section = await screen.findByRole('region', { name: region });
    const entryLink = await within(section).findByRole('link', { name: link });

    for (const second of [0, 1]) {
      // act
      await user.click(entryLink);

      // assert
      const details = await screen.findByRole('dialog', { name: panel });
      const title = await within(details).findByRole('heading', { name: heading });
      expect(title).toBeVisible();
      expect(details).toHaveFocus();
      expect(entryLink).toHaveAttribute('aria-current', 'true');
      expect(screen.getByTestId('details-panel-backdrop')).toBeInTheDocument();

      // user-event emits a compatibility click after a touch drag; browsers suppress it.
      title.addEventListener(
        'pointerdown',
        (event) => {
          event.preventDefault();
        },
        { once: true },
      );

      // act
      vi.setSystemTime(new Date(2026, 9, 20, 12, 0, second));
      await user.pointer({
        keys: '[TouchA>]',
        target: title,
        coords: { clientY: 100 },
      });
      vi.setSystemTime(new Date(2026, 9, 20, 12, 0, second, 100));
      await user.pointer({ pointerName: 'TouchA', coords: { clientY: 200 } });
      await user.pointer({ keys: '[/TouchA]' });

      // assert
      await waitFor(() => {
        expect(screen.queryByTestId('details-panel-backdrop')).not.toBeInTheDocument();
      });
      expect(entryLink).not.toHaveAttribute('aria-current');
      expect(entryLink).toHaveFocus();
    }
  },
);

test.each([
  {
    case: 'an account while a transaction is open',
    initialEntry: `/?transaction=${expense.id}`,
    region: 'Accounts',
    link: /^Wallet/,
    opened: 'Account details',
    kept: 'Transaction details',
  },
  {
    case: 'a transaction while an account is open',
    initialEntry: `/?account=${wallet.id}`,
    region: 'Recent transactions',
    link: /^Groceries/,
    opened: 'Transaction details',
    kept: 'Account details',
  },
])('opens $case and keeps both', async ({ initialEntry, region, link, opened, kept }) => {
  // arrange
  const user = userEvent.setup();
  server.use(
    http.get(`http://localhost/api/accounting/accounts/${wallet.id}`, () =>
      HttpResponse.json(wallet),
    ),
  );
  render(<Component />, { initialEntries: [initialEntry] });
  await screen.findByRole('dialog', { name: kept });
  const section = await screen.findByRole('region', { name: region });

  // act
  await user.click(await within(section).findByRole('link', { name: link }));

  // assert
  expect(await screen.findByRole('dialog', { name: opened })).toBeInTheDocument();
  expect(screen.getByRole('dialog', { name: kept })).toBeInTheDocument();
});

test('shows the latest transactions of the whole history up to the local today', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/accounting/transactions', ({ request }) => {
      const searchParams = new URL(request.url).searchParams;
      return searchParams.get('size') === '15' &&
        !searchParams.has('date_from') &&
        searchParams.get('date_to') === '2026-10-20'
        ? HttpResponse.json({
            items: [income],
            total: 1,
            page: 1,
            size: 15,
            pages: 1,
          } satisfies components['schemas']['Page_Transaction_'])
        : HttpResponse.json(null, { status: 400 });
    }),
  );

  // act
  render(<Component />);

  // assert
  const recent = await screen.findByRole('region', { name: 'Recent transactions' });
  const row = await within(recent).findByRole('listitem');
  expect(row).toHaveTextContent('Design project');
  expect(row).toHaveTextContent('+$640.00');
  expect(screen.getByRole('heading', { name: 'Mon, 02.03.2026' })).toBeInTheDocument();
  expect(screen.queryByText('Nothing here yet')).not.toBeInTheDocument();
});

test('loads the next page when the end of Recent comes into view', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/accounting/transactions', ({ request }) =>
      new URL(request.url).searchParams.get('page') === '1'
        ? HttpResponse.json({
            items: [income],
            total: 2,
            page: 1,
            size: 15,
            pages: 2,
          } satisfies components['schemas']['Page_Transaction_'])
        : HttpResponse.json({
            items: [
              {
                ...income,
                id: '5a1d9c3e-2b4f-4e6a-8c7d-9e0f1a2b3c4e',
                transaction_date: '2026-03-01',
                postings: income.postings.map((posting) => ({
                  ...posting,
                  account:
                    posting.account.kind === 'INCOME'
                      ? { ...posting.account, name: 'Consulting' }
                      : posting.account,
                })),
              },
            ],
            total: 2,
            page: 2,
            size: 15,
            pages: 2,
          } satisfies components['schemas']['Page_Transaction_']),
    ),
  );

  // act
  render(<Component />);

  // assert
  const recent = await screen.findByRole('region', { name: 'Recent transactions' });
  expect(await within(recent).findByText('Consulting')).toBeInTheDocument();
  expect(within(recent).getByText('Design project')).toBeInTheDocument();
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
  expect(screen.getByText('Your income and expenses will show up here.')).toBeInTheDocument();
  const recent = screen.getByRole('region', { name: 'Recent transactions' });
  expect(within(recent).queryByRole('list')).not.toBeInTheDocument();
});

test('hides Recent when its transactions fail to load', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/accounting/transactions', () =>
      HttpResponse.json(null, { status: 500 }),
    ),
  );

  // act
  render(<Component />);

  // assert
  await vi.waitFor(() => {
    expect(screen.queryByRole('region', { name: 'Recent transactions' })).not.toBeInTheDocument();
  });
  expect(screen.queryByText('Nothing here yet')).not.toBeInTheDocument();
});

test('shows a busy recent panel while the transactions load', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/accounting/transactions', async () => {
      await delay('infinite');
    }),
  );

  // act
  render(<Component />);

  // assert
  expect(await screen.findByRole('region', { name: 'Recent transactions' })).toHaveAttribute(
    'aria-busy',
    'true',
  );
  expect(screen.queryByText('Nothing here yet')).not.toBeInTheDocument();
});

test('shows a transaction added elsewhere once the tab is shown again at the top of the list', async () => {
  // arrange
  onTestFinished(() => {
    Reflect.deleteProperty(document, 'visibilityState');
  });
  let isAdded = false;
  const addedIncome = {
    ...income,
    id: '5a1d9c3e-2b4f-4e6a-8c7d-9e0f1a2b3c4f',
    postings: income.postings.map((posting) => ({
      ...posting,
      account:
        posting.account.kind === 'INCOME'
          ? { ...posting.account, name: 'Consulting' }
          : posting.account,
    })),
  } satisfies components['schemas']['Transaction'];
  server.use(
    http.get('http://localhost/api/accounting/transactions', () =>
      HttpResponse.json({
        items: isAdded ? [addedIncome, income] : [income],
        total: isAdded ? 2 : 1,
        page: 1,
        size: 15,
        pages: 1,
      } satisfies components['schemas']['Page_Transaction_']),
    ),
  );
  render(<Component />);
  expect(await screen.findByText('Design project')).toBeInTheDocument();
  isAdded = true;

  // act: the user leaves the tab and comes back
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));

  // assert
  expect(await screen.findByText('Consulting')).toBeInTheDocument();
});

test('replaces the estimates with the valued amounts once refreshed data values them', async () => {
  // arrange
  onTestFinished(() => {
    Reflect.deleteProperty(document, 'visibilityState');
  });
  let isValued = false;
  const card = {
    ...wallet,
    name: 'Credit EUR',
    id: '7f0c2f4e-8c1a-4b9e-9d1f-0e6a3c2b1a09',
    kind: 'ASSET',
    balance: '-300.00',
    currency: 'EUR',
    base_currency_rate: '0',
    base_currency_balance: '0.00',
  } satisfies components['schemas']['Account'];
  const unvaluedExpense = {
    ...expense,
    base_currency_amount: null,
    estimated_base_currency_amount: '324.00',
    postings: expense.postings.map((posting) => ({
      ...posting,
      amount: posting.amount.startsWith('-') ? '-300.00' : '300.00',
      currency: 'EUR',
      base_amount: null,
      estimated_base_amount: posting.amount.startsWith('-') ? '-324.00' : '324.00',
      account: posting.account.kind === 'ASSET' ? card : posting.account,
    })),
  } satisfies components['schemas']['Transaction'];
  const valuedExpense = {
    ...unvaluedExpense,
    base_currency_amount: '318.00',
    estimated_base_currency_amount: null,
    postings: unvaluedExpense.postings.map((posting) => ({
      ...posting,
      base_amount: posting.amount.startsWith('-') ? '-318.00' : '318.00',
      estimated_base_amount: null,
    })),
  } satisfies components['schemas']['Transaction'];
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items: [
          isValued
            ? { ...card, base_currency_rate: '0.9434', base_currency_balance: '-318.00' }
            : { ...card, estimated_base_balance: '-324.00' },
        ],
        total: 1,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']),
    ),
    http.get('http://localhost/api/accounting/summary', () =>
      HttpResponse.json({
        month: '2026-10-01',
        total_balance: isValued ? '-318.00' : '0.00',
        estimated_total_balance: isValued ? null : '-324.00',
        earned: '0.00',
        spent: isValued ? '318.00' : '0.00',
        left_over: isValued ? '-318.00' : '0.00',
        unvalued_spent: isValued ? [] : [{ currency: 'EUR', amount: '300.00' }],
        estimated_unvalued_spent: isValued ? null : '324.00',
        estimate_rates: [],
      } satisfies components['schemas']['Summary']),
    ),
    http.get('http://localhost/api/accounting/transactions', () =>
      HttpResponse.json({
        items: [isValued ? valuedExpense : unvaluedExpense],
        total: 1,
        page: 1,
        size: 15,
        pages: 1,
      } satisfies components['schemas']['Page_Transaction_']),
    ),
  );
  render(<Component />);
  const accounts = await screen.findByRole('region', { name: 'Accounts' });
  const month = screen.getByRole('region', { name: 'This month' });
  const recent = screen.getByRole('region', { name: 'Recent transactions' });
  // the total, the card, the unvalued spending and the row each show an estimate
  expect(await within(recent).findByText('≈ -$324.00')).toBeInTheDocument();
  expect(await within(accounts).findAllByText('≈ -$324.00')).toHaveLength(2);
  expect(within(month).getByText('≈ -$324.00')).toBeInTheDocument();
  isValued = true;

  // act: the user leaves the tab and comes back
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));

  // assert
  // the row and its day total
  expect(await within(recent).findAllByText('-$318.00')).toHaveLength(2);
  await waitFor(() => {
    expect(within(accounts).queryByText(/≈/)).not.toBeInTheDocument();
  });
  // the total and the card
  expect(within(accounts).getAllByText('-$318.00')).toHaveLength(2);
  expect(within(month).queryByText('Unvalued spending')).not.toBeInTheDocument();
  for (const region of [accounts, month, recent]) {
    expect(within(region).queryByText(/≈/)).not.toBeInTheDocument();
  }
});

test('shows skeleton rows instead of the previous transactions while the next day loads', async () => {
  // arrange
  onTestFinished(() => {
    Reflect.deleteProperty(document, 'visibilityState');
  });
  server.use(
    http.get('http://localhost/api/accounting/transactions', async ({ request }) => {
      if (new URL(request.url).searchParams.get('date_to') !== '2026-10-20') {
        await delay('infinite');
      }
      return HttpResponse.json({
        items: [income],
        total: 1,
        page: 1,
        size: 15,
        pages: 1,
      } satisfies components['schemas']['Page_Transaction_']);
    }),
  );
  render(<Component />);
  const recent = await screen.findByRole('region', { name: 'Recent transactions' });
  expect(await within(recent).findByText('Design project')).toBeInTheDocument();
  vi.setSystemTime(new Date(2026, 9, 21, 0, 1));

  // act: the user comes back to the tab after midnight
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));

  // assert
  await waitFor(() => {
    expect(screen.getByRole('region', { name: 'Recent transactions' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
  });
  expect(screen.getByRole('region', { name: 'Recent transactions' })).not.toHaveTextContent(
    'Design project',
  );
  expect(screen.queryByText('Nothing here yet')).not.toBeInTheDocument();
});
