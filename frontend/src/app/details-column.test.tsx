import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, expect, test } from 'vitest';

import type { components } from '@/lib/api-schema';
import { render } from '@/test/render';
import { server } from '@/test/setup';

import { DetailsColumn } from './details-column';

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

const groceries = {
  ...wallet,
  name: 'Groceries',
  description: 'Supermarkets and markets',
  id: '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f',
  kind: 'EXPENSE',
  balance: '0',
  currency: null,
  category_type: 'VARIABLE',
  base_currency_rate: '0',
  base_currency_balance: '0.00',
} satisfies components['schemas']['Account'];

const salary = {
  ...groceries,
  name: 'Salary',
  description: null,
  id: '2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f60',
  kind: 'INCOME',
  category_type: null,
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
      account: groceries,
    },
  ],
} satisfies components['schemas']['Transaction'];

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
        currencies: [],
        account_kinds: [
          { key: 'ASSET', label: 'Asset' },
          { key: 'EXPENSE', label: 'Expense' },
          { key: 'INCOME', label: 'Income' },
        ],
        category_types: [{ key: 'VARIABLE', label: 'Variable' }],
        transaction_types: [{ key: 'EXPENSE', label: 'Expense' }],
        transaction_orders: [],
      } satisfies components['schemas']['AccountingDictionaries']),
    ),
    http.get(`http://localhost/api/accounting/transactions/${expense.id}`, () =>
      HttpResponse.json(expense),
    ),
  );
});

test.each([
  {
    kind: 'a category',
    account: groceries,
    meta: 'Expense · Variable',
    transactionsHref: `/transactions?category_ids=${groceries.id}`,
    deleteLabel: 'Delete category',
  },
  {
    kind: 'an income source',
    account: salary,
    meta: 'Income',
    transactionsHref: `/transactions?income_source_ids=${salary.id}`,
    deleteLabel: 'Delete income source',
  },
])(
  'shows $kind without a balance, with Transactions, Edit and Delete',
  async ({ account, meta, transactionsHref, deleteLabel }) => {
    // arrange
    server.use(
      http.get(`http://localhost/api/accounting/accounts/${account.id}`, () =>
        HttpResponse.json(account),
      ),
    );

    // act
    render(
      <DetailsColumn
        baseCurrency="USD"
        defaultTransactionId={undefined}
        shownAccount={{
          chosenAccountId: account.id,
          defaultAccountId: wallet.id,
          isAccountParamStale: false,
          isAccountOpenedLast: true,
        }}
        accountCount={1}
        isAccountFirst={false}
      />,
      { initialEntries: [`/transactions?transaction=${expense.id}&account=${account.id}`] },
    );

    // assert
    const details = await screen.findByRole('dialog', { name: 'Account details' });
    expect(
      await within(details).findByRole('heading', { level: 2, name: account.name }),
    ).toBeInTheDocument();
    expect(within(details).getByText(meta)).toBeInTheDocument();
    expect(within(details).queryByText('$0.00')).not.toBeInTheDocument();
    expect(within(details).queryByRole('link', { name: 'Adjust balance' })).not.toBeInTheDocument();
    expect(within(details).getByRole('link', { name: 'Transactions' })).toHaveAttribute(
      'href',
      transactionsHref,
    );
    expect(within(details).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(within(details).getByRole('button', { name: deleteLabel })).toBeInTheDocument();
  },
);

test('opens the category form to edit a category', async () => {
  // arrange
  const user = userEvent.setup();
  server.use(
    http.get(`http://localhost/api/accounting/accounts/${groceries.id}`, () =>
      HttpResponse.json(groceries),
    ),
  );
  render(
    <DetailsColumn
      baseCurrency="USD"
      defaultTransactionId={undefined}
      shownAccount={{
        chosenAccountId: groceries.id,
        defaultAccountId: wallet.id,
        isAccountParamStale: false,
        isAccountOpenedLast: true,
      }}
      accountCount={1}
      isAccountFirst={false}
    />,
    { initialEntries: [`/transactions?transaction=${expense.id}&account=${groceries.id}`] },
  );
  const details = await screen.findByRole('dialog', { name: 'Account details' });

  // act
  await user.click(await within(details).findByRole('button', { name: 'Edit' }));

  // assert
  const form = await screen.findByRole('form', { name: 'Edit category' });
  expect(within(form).getByRole('textbox', { name: 'Name' })).toHaveValue('Groceries');
});

test('keeps a deleted category open with Restore and moves the focus to its Transactions', async () => {
  // arrange
  const user = userEvent.setup();
  let category: components['schemas']['Account'] = groceries;
  let deletePath: string | undefined;
  server.use(
    http.get(`http://localhost/api/accounting/accounts/${groceries.id}`, () =>
      HttpResponse.json(category),
    ),
    http.delete('http://localhost/api/accounting/accounts/:accountId', ({ request }) => {
      deletePath = new URL(request.url).pathname;
      category = { ...groceries, status: 'DELETED' };
      return HttpResponse.json(category);
    }),
  );
  render(
    <DetailsColumn
      baseCurrency="USD"
      defaultTransactionId={undefined}
      shownAccount={{
        chosenAccountId: groceries.id,
        defaultAccountId: wallet.id,
        isAccountParamStale: false,
        isAccountOpenedLast: true,
      }}
      accountCount={1}
      isAccountFirst={false}
    />,
    { initialEntries: [`/transactions?transaction=${expense.id}&account=${groceries.id}`] },
  );
  const details = await screen.findByRole('dialog', { name: 'Account details' });
  await user.click(await within(details).findByRole('button', { name: 'Delete category' }));
  const confirmation = screen.getByRole('alertdialog', { name: 'Delete this category?' });

  // act
  await user.click(within(confirmation).getByRole('button', { name: 'Delete' }));

  // assert
  expect(await within(details).findByRole('button', { name: 'Restore' })).toBeInTheDocument();
  expect(deletePath).toBe(`/api/accounting/accounts/${groceries.id}`);
  expect(within(details).getByText('Deleted')).toBeInTheDocument();
  expect(within(details).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  await waitFor(() => {
    expect(within(details).getByRole('link', { name: 'Transactions' })).toHaveFocus();
  });
});

test('restores a deleted category from its details', async () => {
  // arrange
  const user = userEvent.setup();
  let category: components['schemas']['Account'] = { ...groceries, status: 'DELETED' };
  let restorePath: string | undefined;
  server.use(
    http.get(`http://localhost/api/accounting/accounts/${groceries.id}`, () =>
      HttpResponse.json(category),
    ),
    http.post('http://localhost/api/accounting/accounts/:accountId/restore', ({ request }) => {
      restorePath = new URL(request.url).pathname;
      category = groceries;
      return HttpResponse.json(category);
    }),
  );
  render(
    <DetailsColumn
      baseCurrency="USD"
      defaultTransactionId={undefined}
      shownAccount={{
        chosenAccountId: groceries.id,
        defaultAccountId: wallet.id,
        isAccountParamStale: false,
        isAccountOpenedLast: true,
      }}
      accountCount={1}
      isAccountFirst={false}
    />,
    { initialEntries: [`/transactions?transaction=${expense.id}&account=${groceries.id}`] },
  );
  const details = await screen.findByRole('dialog', { name: 'Account details' });
  expect(await within(details).findByText('Deleted')).toBeInTheDocument();
  expect(within(details).getByRole('link', { name: 'Transactions' })).toBeInTheDocument();

  // act
  await user.click(within(details).getByRole('button', { name: 'Restore' }));

  // assert
  expect(await within(details).findByRole('button', { name: 'Edit' })).toBeInTheDocument();
  expect(restorePath).toBe(`/api/accounting/accounts/${groceries.id}/restore`);
  expect(within(details).queryByText('Deleted')).not.toBeInTheDocument();
});

test('opens Restore category when a restore from the details is refused because the name is taken', async () => {
  // arrange
  const user = userEvent.setup();
  server.use(
    http.get(`http://localhost/api/accounting/accounts/${groceries.id}`, () =>
      HttpResponse.json({ ...groceries, status: 'DELETED' }),
    ),
    http.post(`http://localhost/api/accounting/accounts/${groceries.id}/restore`, () =>
      HttpResponse.json(
        {
          error_code: 'NAME_ALREADY_EXISTS',
          message: 'This name is already taken',
        } satisfies components['schemas']['ErrorResponse'],
        { status: 409 },
      ),
    ),
  );
  render(
    <DetailsColumn
      baseCurrency="USD"
      defaultTransactionId={undefined}
      shownAccount={{
        chosenAccountId: groceries.id,
        defaultAccountId: wallet.id,
        isAccountParamStale: false,
        isAccountOpenedLast: true,
      }}
      accountCount={1}
      isAccountFirst={false}
    />,
    { initialEntries: [`/transactions?transaction=${expense.id}&account=${groceries.id}`] },
  );
  const details = await screen.findByRole('dialog', { name: 'Account details' });

  // act
  await user.click(await within(details).findByRole('button', { name: 'Restore' }));

  // assert
  const restoreForm = await screen.findByRole('form', { name: 'Restore category' });
  expect(within(restoreForm).getByRole('textbox', { name: 'Name' })).toHaveAccessibleDescription(
    'An active category already has this name',
  );
});
