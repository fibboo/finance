import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, expect, test, vi } from 'vitest';

import type { components } from '@/lib/api-schema';
import { render } from '@/test/render';
import { server } from '@/test/setup';

import { Component } from './income-sources';

const salary = {
  name: 'Salary',
  description: 'Main job, paid on the 1st',
  id: '4a52f0e1-1d7b-4a52-9f3a-0b5c1f0e8d44',
  user_id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
  kind: 'INCOME',
  balance: '0',
  currency: null,
  color: null,
  category_type: null,
  base_currency_rate: '1',
  status: 'ACTIVE',
  base_currency_balance: '0',
} satisfies components['schemas']['Account'];

const freelance = {
  ...salary,
  name: 'Freelance',
  description: null,
  id: '1d7b4a52-f0e1-4a52-9f3a-0b5c1f0e8d45',
} satisfies components['schemas']['Account'];

const scholarship = {
  ...salary,
  name: 'Scholarship',
  description: null,
  id: '1d7b4a52-f0e1-4a52-9f3a-0b5c1f0e8d46',
  status: 'DELETED',
} satisfies components['schemas']['Account'];

const wallet = {
  ...salary,
  name: 'Wallet',
  description: null,
  id: '7f0c2f4e-8c1a-4b9e-9d1f-0e6a3c2b1a03',
  kind: 'ASSET',
  balance: '1200.00',
  currency: 'USD',
  base_currency_balance: '1200.00',
} satisfies components['schemas']['Account'];

const salaryPayment = {
  id: '5a1d9c3e-2b4f-4e6a-8c7d-9e0f1a2b3c50',
  user_id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
  transaction_date: '2026-10-01',
  comment: null,
  base_currency_amount: '1200.00',
  location: null,
  income_period: null,
  transaction_type: 'INCOME',
  status: 'ACTIVE',
  created_at: '2026-10-01T09:00:00Z',
  updated_at: '2026-10-01T09:00:00Z',
  postings: [
    {
      id: '3e4f5a6b-7c8d-4e9f-8a0b-1c2d3e4f5a70',
      amount: '1200.00',
      currency: 'USD',
      base_amount: '1200.00',
      account: wallet,
    },
    {
      id: '3e4f5a6b-7c8d-4e9f-8a0b-1c2d3e4f5a71',
      amount: '-1200.00',
      currency: 'USD',
      base_amount: '-1200.00',
      account: salary,
    },
  ],
} satisfies components['schemas']['Transaction'];

function readAccountPage(
  items: readonly components['schemas']['Account'][],
): components['schemas']['Page_Account_'] {
  const accountPage = { items: [...items], total: items.length, page: 1, size: 100, pages: 1 };
  return accountPage;
}

beforeEach(() => {
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
    http.get('http://localhost/api/accounting/transactions', () =>
      HttpResponse.json({
        items: [],
        total: 0,
        page: 1,
        size: 15,
        pages: 1,
      } satisfies components['schemas']['Page_Transaction_']),
    ),
    http.get('http://localhost/api/dictionaries/accounting', () =>
      HttpResponse.json({
        currencies: [],
        account_kinds: [],
        category_types: [{ key: 'VARIABLE', label: 'Variable' }],
        transaction_types: [{ key: 'INCOME', label: 'Income' }],
        transaction_orders: [],
      } satisfies components['schemas']['AccountingDictionaries']),
    ),
  );
});

test('shows the number of active income sources and lists them without groups or a type filter', async () => {
  // arrange
  const requestedKinds: string[] = [];
  server.use(
    http.get('http://localhost/api/accounting/accounts', ({ request }) => {
      const query = new URL(request.url).searchParams;
      requestedKinds.push(query.getAll('kinds').join());
      const items = query.getAll('statuses').includes('DELETED')
        ? [salary, freelance, scholarship]
        : [salary, freelance];
      return HttpResponse.json(readAccountPage(items));
    }),
  );

  // act
  render(<Component />, { initialEntries: ['/income-sources'] });

  // assert
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Income sources, 2 income sources' }),
  ).toBeInTheDocument();
  const list = await screen.findByRole('region', { name: 'Income sources' });
  await within(list).findByText('Salary');
  expect(within(list).getAllByRole('listitem')).toHaveLength(3);
  expect(within(list).getByText('Main job, paid on the 1st')).toBeInTheDocument();
  expect(within(list).getByText('(deleted)', { exact: false }).closest('s')).toHaveTextContent(
    'Scholarship',
  );
  expect(within(list).queryByRole('heading')).not.toBeInTheDocument();
  expect(screen.queryByRole('group', { name: 'Category type' })).not.toBeInTheDocument();
  expect(screen.getByRole('switch', { name: 'Deleted' })).toBeChecked();
  expect(new Set(requestedKinds)).toEqual(new Set(['INCOME']));
});

test('requests only the active income sources with Deleted off and keeps it in the URL', async () => {
  // arrange
  const user = userEvent.setup();
  const requestedStatuses: string[] = [];
  server.use(
    http.get('http://localhost/api/accounting/accounts', ({ request }) => {
      const statuses = new URL(request.url).searchParams.getAll('statuses');
      requestedStatuses.push(statuses.join());
      const items = statuses.includes('DELETED') ? [salary, scholarship] : [salary];
      return HttpResponse.json(readAccountPage(items));
    }),
  );
  const { router } = render(<Component />, { initialEntries: ['/income-sources'] });
  const list = await screen.findByRole('region', { name: 'Income sources' });
  expect(await within(list).findByText('Scholarship')).toBeInTheDocument();

  // act
  await user.click(screen.getByRole('switch', { name: 'Deleted' }));

  // assert
  await waitFor(() => {
    expect(within(list).queryByText('Scholarship')).not.toBeInTheDocument();
  });
  expect(requestedStatuses).toContain('ACTIVE');
  expect(new URLSearchParams(router.state.location.search).get('deleted')).toBe('off');
});

test('gives an active row Transactions, Edit and Delete and a deleted one Restore on a phone', async () => {
  // arrange
  vi.stubGlobal('innerWidth', 390);
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json(readAccountPage([salary, scholarship])),
    ),
  );

  // act
  render(<Component />, { initialEntries: ['/income-sources'] });

  // assert
  const list = await screen.findByRole('region', { name: 'Income sources' });
  await within(list).findByText('Salary');
  const [salaryRow, scholarshipRow] = within(list).getAllByRole('listitem');
  if (salaryRow === undefined || scholarshipRow === undefined) {
    throw new Error('Both income sources have a row.');
  }

  expect(within(salaryRow).getByRole('link', { name: 'Transactions' })).toHaveAttribute(
    'href',
    `/transactions?income_source_ids=${salary.id}`,
  );
  expect(within(salaryRow).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  expect(within(salaryRow).getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  expect(within(scholarshipRow).getAllByRole('button')).toHaveLength(1);
  expect(within(scholarshipRow).getByRole('button', { name: 'Restore' })).toBeInTheDocument();
});

test('gives an active row Edit and Delete without Transactions on desktop', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json(readAccountPage([salary, scholarship])),
    ),
  );

  // act
  render(<Component />, { initialEntries: ['/income-sources'] });

  // assert
  const list = await screen.findByRole('region', { name: 'Income sources' });
  await within(list).findByText('Salary');
  const [salaryRow, scholarshipRow] = within(list).getAllByRole('listitem');
  if (salaryRow === undefined || scholarshipRow === undefined) {
    throw new Error('Both entries have a row.');
  }

  expect(within(salaryRow).queryByRole('link', { name: 'Transactions' })).not.toBeInTheDocument();
  expect(
    within(salaryRow)
      .getAllByRole('button')
      .map((button) => button.title),
  ).toEqual(['Edit', 'Delete']);
  expect(
    within(scholarshipRow)
      .getAllByRole('button')
      .map((button) => button.title),
  ).toEqual(['Restore']);
});

test('creates an income source from New income source and lists it', async () => {
  // arrange
  const user = userEvent.setup();
  let incomeSources: components['schemas']['Account'][] = [salary];
  let createdBody: unknown;
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json(readAccountPage(incomeSources)),
    ),
    http.post('http://localhost/api/accounting/accounts', async ({ request }) => {
      createdBody = await request.json();
      incomeSources = [salary, freelance];
      return HttpResponse.json(freelance);
    }),
  );
  render(<Component />, { initialEntries: ['/income-sources'] });
  const list = await screen.findByRole('region', { name: 'Income sources' });
  await within(list).findByText('Salary');
  await user.click(screen.getByRole('button', { name: 'New income source' }));
  const form = await screen.findByRole('form', { name: 'New income source' });
  await user.type(within(form).getByRole('textbox', { name: 'Name' }), 'Freelance');
  await vi.waitFor(() => {
    expect(within(form).getByRole('button', { name: 'Create income source' })).toBeEnabled();
  });

  // act
  await user.click(within(form).getByRole('button', { name: 'Create income source' }));

  // assert
  expect(await within(list).findByText('Freelance')).toBeInTheDocument();
  expect(screen.queryByRole('form', { name: 'New income source' })).not.toBeInTheDocument();
  expect(createdBody).toEqual({ name: 'Freelance', description: null, kind: 'INCOME' });
});

test('edits an income source from its row and lists the saved name', async () => {
  // arrange
  const user = userEvent.setup();
  let incomeSources: components['schemas']['Account'][] = [salary];
  let updatedBody: unknown;
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json(readAccountPage(incomeSources)),
    ),
    http.put(`http://localhost/api/accounting/accounts/${salary.id}`, async ({ request }) => {
      updatedBody = await request.json();
      const saved = { ...salary, name: 'Wages' } satisfies components['schemas']['Account'];
      incomeSources = [saved];
      return HttpResponse.json(saved);
    }),
  );
  render(<Component />, { initialEntries: ['/income-sources'] });
  const list = await screen.findByRole('region', { name: 'Income sources' });
  await user.click(await within(list).findByRole('button', { name: 'Edit' }));
  const form = await screen.findByRole('form', { name: 'Edit income source' });
  const name = within(form).getByRole('textbox', { name: 'Name' });
  await user.clear(name);
  await user.type(name, 'Wages');
  await vi.waitFor(() => {
    expect(within(form).getByRole('button', { name: 'Save changes' })).toBeEnabled();
  });

  // act
  await user.click(within(form).getByRole('button', { name: 'Save changes' }));

  // assert
  expect(await within(list).findByText('Wages')).toBeInTheDocument();
  expect(screen.queryByRole('form', { name: 'Edit income source' })).not.toBeInTheDocument();
  expect(updatedBody).toEqual({ name: 'Wages', description: 'Main job, paid on the 1st' });
});

test('deletes an income source after the confirmation', async () => {
  // arrange
  const user = userEvent.setup();
  let incomeSources: components['schemas']['Account'][] = [salary, freelance];
  let deletedId: unknown;
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json(readAccountPage(incomeSources)),
    ),
    http.delete('http://localhost/api/accounting/accounts/:accountId', ({ params }) => {
      deletedId = params['accountId'];
      incomeSources = [freelance];
      return HttpResponse.json({ ...salary, status: 'DELETED' });
    }),
  );
  render(<Component />, { initialEntries: ['/income-sources'] });
  const list = await screen.findByRole('region', { name: 'Income sources' });
  await within(list).findByText('Salary');
  const [salaryRow] = within(list).getAllByRole('listitem');
  if (salaryRow === undefined) {
    throw new Error('Salary has a row.');
  }

  await user.click(within(salaryRow).getByRole('button', { name: 'Delete' }));
  const confirmation = await screen.findByRole('alertdialog', {
    name: 'Delete this income source?',
  });

  // act
  await user.click(within(confirmation).getByRole('button', { name: 'Delete' }));

  // assert
  await waitFor(() => {
    expect(within(list).queryByText('Salary')).not.toBeInTheDocument();
  });
  expect(deletedId).toBe(salary.id);
});

test('opens Restore income source when a restore is refused because the name is taken', async () => {
  // arrange
  const user = userEvent.setup();
  server.use(
    http.get('http://localhost/api/accounting/accounts', ({ request }) =>
      HttpResponse.json(
        readAccountPage(
          new URL(request.url).searchParams.has('search_term')
            ? [{ ...scholarship, id: '9e0f1a2b-4e6a-4c7d-8e9f-5a1d9c3e3c50', status: 'ACTIVE' }]
            : [scholarship],
        ),
      ),
    ),
    http.post(`http://localhost/api/accounting/accounts/${scholarship.id}/restore`, () =>
      HttpResponse.json(
        {
          error_code: 'NAME_ALREADY_EXISTS',
          message: 'This name is already taken',
        } satisfies components['schemas']['ErrorResponse'],
        { status: 409 },
      ),
    ),
  );
  render(<Component />, { initialEntries: ['/income-sources'] });
  const list = await screen.findByRole('region', { name: 'Income sources' });

  // act
  await user.click(await within(list).findByRole('button', { name: 'Restore' }));

  // assert
  const restoreForm = await screen.findByRole('form', { name: 'Restore income source' });
  const name = within(restoreForm).getByRole('textbox', { name: 'Name' });
  expect(name).toHaveValue('Scholarship');
  await vi.waitFor(() => {
    expect(name).toHaveAccessibleDescription('An active income source already has this name');
  });
});

test('shows the transactions of the top income source beside the list while none is chosen', async () => {
  // arrange
  const requestedAccountIds: string[] = [];
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json(readAccountPage([salary, freelance])),
    ),
    http.get('http://localhost/api/accounting/transactions', ({ request }) => {
      requestedAccountIds.push(new URL(request.url).searchParams.getAll('account_ids').join());
      return HttpResponse.json({
        items: [],
        total: 0,
        page: 1,
        size: 15,
        pages: 1,
      } satisfies components['schemas']['Page_Transaction_']);
    }),
  );

  // act
  render(<Component />, { initialEntries: ['/income-sources'] });

  // assert
  const transactions = await screen.findByRole('region', { name: 'Transactions of Salary' });
  expect(within(transactions).getByRole('heading', { name: 'Salary' })).toBeInTheDocument();
  expect(within(transactions).getByText('Income source · recent transactions')).toBeInTheDocument();
  expect(within(transactions).getByRole('link', { name: 'All' })).toHaveAttribute(
    'href',
    `/transactions?income_source_ids=${salary.id}`,
  );
  expect(
    await within(transactions).findByText('No transactions from this income source yet'),
  ).toBeInTheDocument();
  expect(requestedAccountIds).toEqual([salary.id]);
});

test('gives a phone plain names and no transactions of an income source', async () => {
  // arrange
  vi.stubGlobal('innerWidth', 390);
  let transactionRequestCount = 0;
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json(readAccountPage([salary, freelance])),
    ),
    http.get('http://localhost/api/accounting/transactions', () => {
      transactionRequestCount += 1;
      return HttpResponse.json(null, { status: 400 });
    }),
  );

  // act
  render(<Component />, { initialEntries: [`/income-sources?account=${freelance.id}`] });

  // assert
  const list = await screen.findByRole('region', { name: 'Income sources' });
  expect(await within(list).findByText('Salary')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Freelance' })).not.toBeInTheDocument();
  expect(screen.queryByRole('region', { name: /^Transactions of/ })).not.toBeInTheDocument();
  expect(transactionRequestCount).toBe(0);
});

test('shows an empty state instead of the list when there are no income sources', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json(readAccountPage([])),
    ),
  );

  // act
  render(<Component />, { initialEntries: ['/income-sources'] });

  // assert
  expect(await screen.findByText('No income sources yet')).toBeInTheDocument();
  expect(
    screen.getByText('Add where your money comes from, like a salary or a client.'),
  ).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Income sources' })).not.toBeInTheDocument();
});

test.each([
  { action: 'Edit', entry: salary, role: 'form', sheetName: 'Edit income source' },
  { action: 'Delete', entry: salary, role: 'alertdialog', sheetName: 'Delete this income source?' },
  { action: 'Restore', entry: scholarship, role: 'form', sheetName: 'Restore income source' },
] as const)(
  'keeps $sheetName closed when its income source comes back after a search hid it',
  async ({ action, entry, role, sheetName }) => {
    // arrange
    const user = userEvent.setup();
    server.use(
      http.get('http://localhost/api/accounting/accounts', ({ request }) => {
        const searchTerm = new URL(request.url).searchParams.get('search_term');
        return HttpResponse.json(readAccountPage(searchTerm === null ? [entry] : [freelance]));
      }),
      http.post('http://localhost/api/accounting/accounts/:id/restore', () =>
        HttpResponse.json(
          {
            error_code: 'NAME_ALREADY_EXISTS',
            message: 'This name is already taken',
          } satisfies components['schemas']['ErrorResponse'],
          { status: 409 },
        ),
      ),
    );
    const { router } = render(<Component />, { initialEntries: ['/income-sources'] });
    const list = await screen.findByRole('region', { name: 'Income sources' });
    await user.click(await within(list).findByRole('button', { name: action }));
    expect(await screen.findByRole(role, { name: sheetName })).toBeInTheDocument();
    await act(() => router.navigate('/income-sources?search=Free'));
    await waitFor(() => {
      expect(screen.queryByRole(role, { name: sheetName })).not.toBeInTheDocument();
    });

    // act
    await act(() => router.navigate(-1));

    // assert
    expect(await screen.findByRole('region', { name: 'Income sources' })).toHaveTextContent(
      entry.name,
    );
    expect(screen.queryByRole(role, { name: sheetName })).not.toBeInTheDocument();
  },
);

test('shows the chosen transaction of an income source with its money account and drops it when another income source is chosen on a wide desktop', async () => {
  // arrange
  const user = userEvent.setup();
  vi.stubGlobal('innerWidth', 1280);
  server.use(
    http.get('http://localhost/api/dictionaries/accounting', () =>
      HttpResponse.json({
        currencies: [],
        account_kinds: [
          { key: 'ASSET', label: 'Asset' },
          { key: 'INCOME', label: 'Income' },
        ],
        category_types: [],
        transaction_types: [{ key: 'INCOME', label: 'Income' }],
        transaction_orders: [],
      } satisfies components['schemas']['AccountingDictionaries']),
    ),
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json(readAccountPage([salary, freelance])),
    ),
    http.get('http://localhost/api/accounting/transactions', ({ request }) => {
      const items =
        new URL(request.url).searchParams.getAll('account_ids').join() === salary.id
          ? [salaryPayment]
          : [];
      return HttpResponse.json({
        items,
        total: items.length,
        page: 1,
        size: 15,
        pages: 1,
      } satisfies components['schemas']['Page_Transaction_']);
    }),
    http.get(`http://localhost/api/accounting/transactions/${salaryPayment.id}`, () =>
      HttpResponse.json(salaryPayment),
    ),
    http.get(`http://localhost/api/accounting/accounts/${wallet.id}`, () =>
      HttpResponse.json(wallet),
    ),
  );
  const { router } = render(<Component />, {
    initialEntries: [`/income-sources?account=${salary.id}&transaction=${salaryPayment.id}`],
  });

  // assert
  const transactionDetails = await screen.findByRole('dialog', { name: 'Transaction details' });
  expect(await within(transactionDetails).findByRole('link', { name: 'Salary' })).toHaveAttribute(
    'href',
    `/income-sources?account=${salary.id}`,
  );
  const accountDetails = await screen.findByRole('dialog', { name: 'Account details' });
  expect(await within(accountDetails).findByText('Wallet')).toBeInTheDocument();
  const salaryTransactions = screen.getByRole('region', { name: 'Transactions of Salary' });
  expect(
    await within(salaryTransactions).findByRole('link', { current: true }),
  ).toBeInTheDocument();

  // act
  await user.click(screen.getByRole('link', { name: 'Freelance' }));

  // assert
  expect(
    await screen.findByRole('region', { name: 'Transactions of Freelance' }),
  ).toBeInTheDocument();
  expect(router.state.location.search).toBe(`?account=${freelance.id}`);
  await waitFor(() => {
    expect(screen.queryByRole('dialog', { name: 'Transaction details' })).not.toBeInTheDocument();
  });
});
