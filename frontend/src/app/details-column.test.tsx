import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, expect, test } from 'vitest';

import type { components } from '@/lib/api-schema';
import { render } from '@/test/render';
import { server } from '@/test/setup';

import { DetailsColumn } from './details-column';
import { useShownAccount } from './use-shown-account';

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

const spar = {
  name: 'Spar',
  description: 'Near home',
  id: '4a52f0e1-1d7b-4a52-9f3a-0b5c1f0e8d44',
  user_id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
  status: 'ACTIVE',
  created_at: '2026-10-01T09:00:00Z',
  updated_at: '2026-10-01T09:00:00Z',
} satisfies components['schemas']['Location'];

const expenseAtSpar = {
  ...expense,
  id: '5a1d9c3e-2b4f-4e6a-8c7d-9e0f1a2b3c41',
  location: spar,
} satisfies components['schemas']['Transaction'];

function ShownDetailsColumn() {
  const shownAccount = useShownAccount({
    defaultTransactionId: undefined,
    firstAccountId: undefined,
  });
  return (
    <DetailsColumn
      baseCurrency="USD"
      defaultTransactionId={undefined}
      shownAccount={shownAccount}
      accountCount={1}
      isAccountFirst={false}
    />
  );
}

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
    http.get(`http://localhost/api/accounting/transactions/${expenseAtSpar.id}`, () =>
      HttpResponse.json(expenseAtSpar),
    ),
    http.get(`http://localhost/api/accounting/accounts/${wallet.id}`, () =>
      HttpResponse.json(wallet),
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
          shownLocationId: undefined,
          isLocationOpenedLast: false,
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
        shownLocationId: undefined,
        isLocationOpenedLast: false,
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
        shownLocationId: undefined,
        isLocationOpenedLast: false,
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
        shownLocationId: undefined,
        isLocationOpenedLast: false,
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
        shownLocationId: undefined,
        isLocationOpenedLast: false,
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

test('restores a category under a new name from its details and moves the focus to its Transactions', async () => {
  // arrange
  const user = userEvent.setup();
  let category: components['schemas']['Account'] = { ...groceries, status: 'DELETED' };
  const restoreBodies: unknown[] = [];
  server.use(
    http.get(`http://localhost/api/accounting/accounts/${groceries.id}`, () =>
      HttpResponse.json(category),
    ),
    http.post(
      `http://localhost/api/accounting/accounts/${groceries.id}/restore`,
      async ({ request }) => {
        const body: unknown = await request.json();
        restoreBodies.push(body);
        if (restoreBodies.length === 1) {
          return HttpResponse.json(
            {
              error_code: 'NAME_ALREADY_EXISTS',
              message: 'This name is already taken',
            } satisfies components['schemas']['ErrorResponse'],
            { status: 409 },
          );
        }
        category = { ...groceries, name: 'Groceries 2025' };
        return HttpResponse.json(category);
      },
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
        shownLocationId: undefined,
        isLocationOpenedLast: false,
      }}
      accountCount={1}
      isAccountFirst={false}
    />,
    { initialEntries: [`/transactions?transaction=${expense.id}&account=${groceries.id}`] },
  );
  const details = await screen.findByRole('dialog', { name: 'Account details' });
  await user.click(await within(details).findByRole('button', { name: 'Restore' }));
  const restoreForm = await screen.findByRole('form', { name: 'Restore category' });
  const name = within(restoreForm).getByRole('textbox', { name: 'Name' });
  await user.clear(name);
  await user.type(name, 'Groceries 2025');

  // act
  await user.click(within(restoreForm).getByRole('button', { name: 'Restore category' }));

  // assert
  expect(
    await within(details).findByRole('heading', { level: 2, name: 'Groceries 2025' }),
  ).toBeInTheDocument();
  expect(restoreBodies).toEqual([{}, { name: 'Groceries 2025' }]);
  expect(screen.queryByRole('form', { name: 'Restore category' })).not.toBeInTheDocument();
  await waitFor(() => {
    expect(within(details).getByRole('link', { name: 'Transactions' })).toHaveFocus();
  });
});

test('opens the location of a transaction with Transactions, Edit and Delete', async () => {
  // arrange
  const user = userEvent.setup();
  server.use(
    http.get(`http://localhost/api/accounting/locations/${spar.id}`, () => HttpResponse.json(spar)),
  );
  const { router } = render(<ShownDetailsColumn />, {
    initialEntries: [`/transactions?transaction=${expenseAtSpar.id}`],
  });
  const transactionDetails = await screen.findByRole('dialog', { name: 'Transaction details' });

  // act
  await user.click(await within(transactionDetails).findByRole('link', { name: 'Spar' }));

  // assert
  const details = await screen.findByRole('dialog', { name: 'Location details' });
  expect(
    await within(details).findByRole('heading', { level: 2, name: 'Spar' }),
  ).toBeInTheDocument();
  expect(router.state.location.search).toBe(`?transaction=${expenseAtSpar.id}&location=${spar.id}`);
  expect(within(details).getByText('Location')).toBeInTheDocument();
  expect(within(details).getByText('Near home')).toBeInTheDocument();
  expect(within(details).getByRole('link', { name: 'Transactions' })).toHaveAttribute(
    'href',
    `/transactions?location_ids=${spar.id}`,
  );
  expect(within(details).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  expect(within(details).getByRole('button', { name: 'Delete location' })).toBeInTheDocument();
  expect(screen.queryByRole('dialog', { name: 'Account details' })).not.toBeInTheDocument();
});

test('shows the account in place of the location when the account was chosen after it', async () => {
  // arrange
  server.use(
    http.get(`http://localhost/api/accounting/locations/${spar.id}`, () => HttpResponse.json(spar)),
  );

  // act
  render(<ShownDetailsColumn />, {
    initialEntries: [
      `/transactions?transaction=${expenseAtSpar.id}&location=${spar.id}&account=${wallet.id}`,
    ],
  });

  // assert
  const details = await screen.findByRole('dialog', { name: 'Account details' });
  expect(
    await within(details).findByRole('heading', { level: 2, name: 'Wallet' }),
  ).toBeInTheDocument();
  expect(screen.queryByRole('dialog', { name: 'Location details' })).not.toBeInTheDocument();
});

test('ignores a location chosen before a transaction at another location', async () => {
  // act
  render(<ShownDetailsColumn />, {
    initialEntries: [`/transactions?location=${spar.id}&transaction=${expense.id}`],
  });

  // assert
  expect(await screen.findByRole('dialog', { name: 'Transaction details' })).toBeInTheDocument();
  expect(await screen.findByRole('dialog', { name: 'Account details' })).toBeInTheDocument();
  expect(screen.queryByRole('dialog', { name: 'Location details' })).not.toBeInTheDocument();
});

test('drops a location that is not found', async () => {
  // arrange
  server.use(
    http.get(`http://localhost/api/accounting/locations/${spar.id}`, () =>
      HttpResponse.json(
        {
          error_code: 'ENTITY_NOT_FOUND',
          message: 'Location not found',
        } satisfies components['schemas']['ErrorResponse'],
        { status: 404 },
      ),
    ),
  );

  // act
  const { router } = render(<ShownDetailsColumn />, {
    initialEntries: [`/transactions?transaction=${expenseAtSpar.id}&location=${spar.id}`],
  });

  // assert
  await waitFor(() => {
    expect(router.state.location.search).toBe(`?transaction=${expenseAtSpar.id}`);
  });
  expect(screen.queryByRole('dialog', { name: 'Location details' })).not.toBeInTheDocument();
});

test('opens the location form to edit a location', async () => {
  // arrange
  const user = userEvent.setup();
  server.use(
    http.get(`http://localhost/api/accounting/locations/${spar.id}`, () => HttpResponse.json(spar)),
  );
  render(<ShownDetailsColumn />, {
    initialEntries: [`/transactions?transaction=${expenseAtSpar.id}&location=${spar.id}`],
  });
  const details = await screen.findByRole('dialog', { name: 'Location details' });

  // act
  await user.click(await within(details).findByRole('button', { name: 'Edit' }));

  // assert
  const form = await screen.findByRole('form', { name: 'Edit location' });
  expect(within(form).getByRole('textbox', { name: 'Name' })).toHaveValue('Spar');
});

test('keeps a deleted location open with Restore and moves the focus to its Transactions', async () => {
  // arrange
  const user = userEvent.setup();
  let location: components['schemas']['Location'] = spar;
  let deletePath: string | undefined;
  server.use(
    http.get(`http://localhost/api/accounting/locations/${spar.id}`, () =>
      HttpResponse.json(location),
    ),
    http.delete('http://localhost/api/accounting/locations/:locationId', ({ request }) => {
      deletePath = new URL(request.url).pathname;
      location = { ...spar, status: 'DELETED' };
      return HttpResponse.json(location);
    }),
  );
  render(<ShownDetailsColumn />, {
    initialEntries: [`/transactions?transaction=${expenseAtSpar.id}&location=${spar.id}`],
  });
  const details = await screen.findByRole('dialog', { name: 'Location details' });
  await user.click(await within(details).findByRole('button', { name: 'Delete location' }));
  const confirmation = screen.getByRole('alertdialog', { name: 'Delete this location?' });

  // act
  await user.click(within(confirmation).getByRole('button', { name: 'Delete' }));

  // assert
  expect(await within(details).findByRole('button', { name: 'Restore' })).toBeInTheDocument();
  expect(deletePath).toBe(`/api/accounting/locations/${spar.id}`);
  expect(within(details).getByText('Deleted')).toBeInTheDocument();
  expect(within(details).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  await waitFor(() => {
    expect(within(details).getByRole('link', { name: 'Transactions' })).toHaveFocus();
  });
});

test('restores a deleted location from its details', async () => {
  // arrange
  const user = userEvent.setup();
  let location: components['schemas']['Location'] = { ...spar, status: 'DELETED' };
  let restorePath: string | undefined;
  server.use(
    http.get(`http://localhost/api/accounting/locations/${spar.id}`, () =>
      HttpResponse.json(location),
    ),
    http.post('http://localhost/api/accounting/locations/:locationId/restore', ({ request }) => {
      restorePath = new URL(request.url).pathname;
      location = spar;
      return HttpResponse.json(location);
    }),
  );
  render(<ShownDetailsColumn />, {
    initialEntries: [`/transactions?transaction=${expenseAtSpar.id}&location=${spar.id}`],
  });
  const details = await screen.findByRole('dialog', { name: 'Location details' });
  expect(await within(details).findByText('Deleted')).toBeInTheDocument();

  // act
  await user.click(within(details).getByRole('button', { name: 'Restore' }));

  // assert
  expect(await within(details).findByRole('button', { name: 'Edit' })).toBeInTheDocument();
  expect(restorePath).toBe(`/api/accounting/locations/${spar.id}/restore`);
  expect(within(details).queryByText('Deleted')).not.toBeInTheDocument();
});

test('opens Restore location when a restore from the details is refused because the name is taken', async () => {
  // arrange
  const user = userEvent.setup();
  server.use(
    http.get(`http://localhost/api/accounting/locations/${spar.id}`, () =>
      HttpResponse.json({ ...spar, status: 'DELETED' }),
    ),
    http.post(`http://localhost/api/accounting/locations/${spar.id}/restore`, () =>
      HttpResponse.json(
        {
          error_code: 'NAME_ALREADY_EXISTS',
          message: 'This name is already taken',
        } satisfies components['schemas']['ErrorResponse'],
        { status: 409 },
      ),
    ),
  );
  render(<ShownDetailsColumn />, {
    initialEntries: [`/transactions?transaction=${expenseAtSpar.id}&location=${spar.id}`],
  });
  const details = await screen.findByRole('dialog', { name: 'Location details' });

  // act
  await user.click(await within(details).findByRole('button', { name: 'Restore' }));

  // assert
  expect(await screen.findByRole('form', { name: 'Restore location' })).toBeInTheDocument();
});
