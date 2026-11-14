import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, expect, test, vi } from 'vitest';

import type { components } from '@/lib/api-schema';
import { render } from '@/test/render';
import { server } from '@/test/setup';

import { Component } from './categories';

const groceries = {
  name: 'Groceries',
  description: 'Supermarkets and markets',
  id: '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f',
  user_id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
  kind: 'EXPENSE',
  balance: '0',
  currency: null,
  color: null,
  category_type: 'VARIABLE',
  base_currency_rate: '1',
  status: 'ACTIVE',
  base_currency_balance: '0',
} satisfies components['schemas']['Account'];

const cigarettes = {
  ...groceries,
  name: 'Cigarettes',
  description: 'Quit in March',
  id: '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e60',
  status: 'DELETED',
} satisfies components['schemas']['Account'];

const rent = {
  ...groceries,
  name: 'Rent',
  description: null,
  id: '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e61',
  category_type: 'FIXED',
} satisfies components['schemas']['Account'];

const rentPayment = {
  id: '5a1d9c3e-2b4f-4e6a-8c7d-9e0f1a2b3c40',
  user_id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
  transaction_date: '2026-10-05',
  comment: null,
  base_currency_amount: '900.00',
  location: null,
  income_period: null,
  transaction_type: 'EXPENSE',
  status: 'ACTIVE',
  created_at: '2026-10-05T09:00:00Z',
  updated_at: '2026-10-05T09:00:00Z',
  postings: [
    {
      id: '3e4f5a6b-7c8d-4e9f-8a0b-1c2d3e4f5a60',
      amount: '-900.00',
      currency: 'USD',
      base_amount: '-900.00',
      account: {
        ...groceries,
        name: 'Main card',
        description: null,
        id: '7f0c2f4e-8c1a-4b9e-9d1f-0e6a3c2b1a03',
        kind: 'ASSET',
        currency: 'USD',
        category_type: null,
      },
    },
    {
      id: '3e4f5a6b-7c8d-4e9f-8a0b-1c2d3e4f5a61',
      amount: '900.00',
      currency: 'USD',
      base_amount: '900.00',
      account: rent,
    },
  ],
} satisfies components['schemas']['Transaction'];

const earlierRentPayment = {
  ...rentPayment,
  id: '5a1d9c3e-2b4f-4e6a-8c7d-9e0f1a2b3c41',
  transaction_date: '2026-09-05',
  base_currency_amount: '850.00',
  postings: rentPayment.postings.map((posting) => ({
    ...posting,
    id: `${posting.id.slice(0, -1)}9`,
    amount: posting.amount.replace('900', '850'),
    base_amount: posting.base_amount.replace('900', '850'),
  })),
} satisfies components['schemas']['Transaction'];

const [mainCardPosting] = rentPayment.postings;

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
        category_types: [
          { key: 'VARIABLE', label: 'Variable' },
          { key: 'FIXED', label: 'Fixed' },
          { key: 'PERIODIC', label: 'Periodic' },
        ],
        transaction_types: [{ key: 'EXPENSE', label: 'Expense' }],
        transaction_orders: [],
      } satisfies components['schemas']['AccountingDictionaries']),
    ),
  );
});

test('shows the number of active categories and lists them by type with the deleted struck through', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/accounting/accounts', ({ request }) => {
      const statuses = new URL(request.url).searchParams.getAll('statuses');
      const items = statuses.includes('DELETED')
        ? [groceries, cigarettes, rent]
        : [groceries, rent];
      return HttpResponse.json({
        items,
        total: items.length,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']);
    }),
  );

  // act
  render(<Component />, { initialEntries: ['/categories'] });

  // assert
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Categories, 2 categories' }),
  ).toBeInTheDocument();
  const variable = await screen.findByRole('region', { name: 'Variable' });
  expect(within(variable).getByText('2')).toBeInTheDocument();
  expect(within(variable).getByText('Supermarkets and markets')).toBeInTheDocument();
  expect(within(variable).getByText('(deleted)', { exact: false }).closest('s')).toHaveTextContent(
    'Cigarettes',
  );
  expect(screen.getByRole('region', { name: 'Fixed' })).toHaveTextContent('Rent');
  expect(screen.queryByRole('region', { name: 'Periodic' })).not.toBeInTheDocument();
  expect(screen.getByRole('switch', { name: 'Deleted' })).toBeChecked();
  expect(screen.getByRole('radio', { name: 'All' })).toBeChecked();
});

test('requests the chosen type and only the active categories with Deleted off and keeps both in the URL', async () => {
  // arrange
  const user = userEvent.setup();
  const requestedQueries: URLSearchParams[] = [];
  server.use(
    http.get('http://localhost/api/accounting/accounts', ({ request }) => {
      const query = new URL(request.url).searchParams;
      requestedQueries.push(query);
      const items = query.getAll('category_types').includes('FIXED') ? [rent] : [groceries, rent];
      return HttpResponse.json({
        items,
        total: items.length,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']);
    }),
  );
  const { router } = render(<Component />, { initialEntries: ['/categories'] });
  await screen.findByRole('region', { name: 'Variable' });

  // act
  await user.click(screen.getByRole('radio', { name: 'Fixed' }));
  await user.click(screen.getByRole('switch', { name: 'Deleted' }));

  // assert
  await waitFor(() => {
    expect(
      requestedQueries.some(
        (query) =>
          query.getAll('category_types').join() === 'FIXED' &&
          query.getAll('statuses').join() === 'ACTIVE' &&
          query.getAll('kinds').join() === 'EXPENSE',
      ),
    ).toBe(true);
  });
  expect(await screen.findByRole('region', { name: 'Fixed' })).toHaveTextContent('Rent');
  expect(screen.queryByRole('region', { name: 'Variable' })).not.toBeInTheDocument();
  const searchParams = new URLSearchParams(router.state.location.search);
  expect(searchParams.get('category_type')).toBe('FIXED');
  expect(searchParams.get('deleted')).toBe('off');
});

test('opens with Deleted off when it was turned off on an earlier visit and stores turning it on', async () => {
  // arrange
  const user = userEvent.setup();
  localStorage.setItem('deleted:categories', 'off');
  server.use(
    http.get('http://localhost/api/accounting/accounts', ({ request }) => {
      const statuses = new URL(request.url).searchParams.getAll('statuses');
      const items = statuses.includes('DELETED')
        ? [groceries, cigarettes, rent]
        : [groceries, rent];
      return HttpResponse.json({
        items,
        total: items.length,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']);
    }),
  );
  const { router } = render(<Component />, { initialEntries: ['/categories'] });
  const variable = await screen.findByRole('region', { name: 'Variable' });
  expect(within(variable).queryByText('Cigarettes')).not.toBeInTheDocument();
  expect(screen.getByRole('switch', { name: 'Deleted' })).not.toBeChecked();

  // act
  await user.click(screen.getByRole('switch', { name: 'Deleted' }));

  // assert
  expect(await within(variable).findByText('Cigarettes')).toBeInTheDocument();
  expect(localStorage.getItem('deleted:categories')).toBe('on');
  expect(new URLSearchParams(router.state.location.search).get('deleted')).toBe('on');
});

test('reads the type and the toggle from the URL and drops a type the dictionary lacks', async () => {
  // arrange
  const requestedQueries: URLSearchParams[] = [];
  server.use(
    http.get('http://localhost/api/accounting/accounts', ({ request }) => {
      requestedQueries.push(new URL(request.url).searchParams);
      const items = [groceries];
      return HttpResponse.json({
        items,
        total: items.length,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']);
    }),
  );

  // act
  render(<Component />, { initialEntries: ['/categories?category_type=OTHER&deleted=off'] });

  // assert
  expect(await screen.findByRole('region', { name: 'Variable' })).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: 'All' })).toBeChecked();
  expect(screen.getByRole('switch', { name: 'Deleted' })).not.toBeChecked();
  expect(requestedQueries.some((query) => query.has('category_types'))).toBe(false);
});

test('searches from 3 characters and clears the search into a focused field when nothing matches', async () => {
  // arrange
  const user = userEvent.setup();
  const requestedTerms: (string | null)[] = [];
  server.use(
    http.get('http://localhost/api/accounting/accounts', ({ request }) => {
      const searchTerm = new URL(request.url).searchParams.get('search_term');
      requestedTerms.push(searchTerm);
      const items = searchTerm === null ? [groceries, rent] : [];
      return HttpResponse.json({
        items,
        total: items.length,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']);
    }),
  );
  render(<Component />, { initialEntries: ['/categories'] });
  await screen.findByRole('region', { name: 'Variable' });
  const searchField = screen.getByRole('searchbox', { name: 'Search categories' });
  await user.type(searchField, 'zzz');
  expect(await screen.findByText('No categories match this search')).toBeInTheDocument();

  // act
  await user.click(screen.getByRole('button', { name: 'Clear search' }));

  // assert
  expect(await screen.findByRole('region', { name: 'Variable' })).toBeInTheDocument();
  const clearedField = screen.getByRole('searchbox', { name: 'Search categories' });
  expect(clearedField).toHaveValue('');
  expect(clearedField).toHaveFocus();
  expect(requestedTerms).toContain('zzz');
  expect(requestedTerms).not.toContain('zz');
});

test('creates a category from New category and lists it', async () => {
  // arrange
  const user = userEvent.setup();
  let categories: components['schemas']['Account'][] = [groceries];
  let createdBody: unknown;
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items: categories,
        total: categories.length,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']),
    ),
    http.post('http://localhost/api/accounting/accounts', async ({ request }) => {
      createdBody = await request.json();
      categories = [groceries, rent];
      return HttpResponse.json(rent);
    }),
  );
  render(<Component />, { initialEntries: ['/categories'] });
  await screen.findByRole('region', { name: 'Variable' });
  await user.click(screen.getByRole('button', { name: 'New category' }));
  const form = await screen.findByRole('form', { name: 'New category' });
  await user.type(within(form).getByRole('textbox', { name: 'Name' }), 'Rent');
  await user.click(within(form).getByRole('radio', { name: 'Fixed' }));
  await vi.waitFor(() => {
    expect(within(form).getByRole('button', { name: 'Create category' })).toBeEnabled();
  });

  // act
  await user.click(within(form).getByRole('button', { name: 'Create category' }));

  // assert
  expect(await screen.findByRole('region', { name: 'Fixed' })).toHaveTextContent('Rent');
  expect(screen.queryByRole('form', { name: 'New category' })).not.toBeInTheDocument();
  expect(createdBody).toMatchObject({ name: 'Rent', kind: 'EXPENSE', category_type: 'FIXED' });
});

test('gives an active row Transactions, Edit and Delete and a deleted one Restore on a phone', async () => {
  // arrange
  vi.stubGlobal('innerWidth', 390);
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items: [groceries, cigarettes],
        total: 2,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']),
    ),
  );

  // act
  render(<Component />, { initialEntries: ['/categories'] });

  // assert
  const variable = await screen.findByRole('region', { name: 'Variable' });
  const [groceriesRow, cigarettesRow] = within(variable).getAllByRole('listitem');
  if (groceriesRow === undefined || cigarettesRow === undefined) {
    throw new Error('Both categories have a row.');
  }

  expect(within(groceriesRow).getByRole('link', { name: 'Transactions' })).toHaveAttribute(
    'href',
    `/transactions?category_ids=${groceries.id}`,
  );
  expect(within(groceriesRow).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  expect(within(groceriesRow).getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  expect(within(groceriesRow).queryByRole('button', { name: 'Restore' })).not.toBeInTheDocument();
  expect(within(cigarettesRow).getByRole('button', { name: 'Restore' })).toBeInTheDocument();
  expect(
    within(cigarettesRow).queryByRole('link', { name: 'Transactions' }),
  ).not.toBeInTheDocument();
  expect(within(cigarettesRow).getAllByRole('button')).toHaveLength(1);
});

test('gives an active row Edit and Delete without Transactions on desktop', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items: [groceries, cigarettes],
        total: 2,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']),
    ),
  );

  // act
  render(<Component />, { initialEntries: ['/categories'] });

  // assert
  const list = await screen.findByRole('region', { name: 'Variable' });
  const [groceriesRow, cigarettesRow] = within(list).getAllByRole('listitem');
  if (groceriesRow === undefined || cigarettesRow === undefined) {
    throw new Error('Both entries have a row.');
  }

  expect(
    within(groceriesRow).queryByRole('link', { name: 'Transactions' }),
  ).not.toBeInTheDocument();
  expect(
    within(groceriesRow)
      .getAllByRole('button')
      .map((button) => button.title),
  ).toEqual(['Edit', 'Delete']);
  expect(
    within(cigarettesRow)
      .getAllByRole('button')
      .map((button) => button.title),
  ).toEqual(['Restore']);
});

test('edits a category from its row and lists the saved name', async () => {
  // arrange
  const user = userEvent.setup();
  let categories: components['schemas']['Account'][] = [groceries, rent];
  let updatedBody: unknown;
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items: categories,
        total: categories.length,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']),
    ),
    http.put(`http://localhost/api/accounting/accounts/${rent.id}`, async ({ request }) => {
      updatedBody = await request.json();
      const flat = { ...rent, name: 'Flat' } satisfies components['schemas']['Account'];
      categories = [groceries, flat];
      return HttpResponse.json(flat);
    }),
  );
  render(<Component />, { initialEntries: ['/categories'] });
  const fixed = await screen.findByRole('region', { name: 'Fixed' });
  await user.click(within(fixed).getByRole('button', { name: 'Edit' }));
  const form = await screen.findByRole('form', { name: 'Edit category' });
  const name = within(form).getByRole('textbox', { name: 'Name' });
  expect(name).toHaveValue('Rent');
  expect(within(form).getByRole('radio', { name: 'Fixed' })).toBeChecked();
  await user.clear(name);
  await user.type(name, 'Flat');
  await vi.waitFor(() => {
    expect(within(form).getByRole('button', { name: 'Save changes' })).toBeEnabled();
  });

  // act
  await user.click(within(form).getByRole('button', { name: 'Save changes' }));

  // assert
  expect(await screen.findByRole('region', { name: 'Fixed' })).toHaveTextContent('Flat');
  expect(screen.queryByRole('form', { name: 'Edit category' })).not.toBeInTheDocument();
  expect(updatedBody).toEqual({ name: 'Flat', description: null, category_type: 'FIXED' });
});

test('deletes a category after the confirmation and moves the focus to the next row', async () => {
  // arrange
  const user = userEvent.setup();
  let categories: components['schemas']['Account'][] = [groceries, rent];
  let deletePath: string | undefined;
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items: categories,
        total: categories.length,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']),
    ),
    http.delete('http://localhost/api/accounting/accounts/:accountId', ({ request }) => {
      deletePath = new URL(request.url).pathname;
      categories = [rent];
      return HttpResponse.json({ ...groceries, status: 'DELETED' });
    }),
  );
  render(<Component />, { initialEntries: ['/categories?deleted=off'] });
  const variable = await screen.findByRole('region', { name: 'Variable' });
  await user.click(within(variable).getByRole('button', { name: 'Delete' }));
  const confirmation = screen.getByRole('alertdialog', { name: 'Delete this category?' });
  expect(confirmation).toHaveAccessibleDescription(
    'Groceries. It leaves your categories and the pickers, and its past transactions keep showing it.',
  );

  // act
  await user.click(within(confirmation).getByRole('button', { name: 'Delete' }));

  // assert
  await waitFor(() => {
    expect(screen.queryByRole('region', { name: 'Variable' })).not.toBeInTheDocument();
  });
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(deletePath).toBe(`/api/accounting/accounts/${groceries.id}`);
  expect(
    within(screen.getByRole('region', { name: 'Fixed' })).getByRole('button', { name: 'Edit' }),
  ).toHaveFocus();
});

test('keeps the category when its deletion is cancelled and returns the focus to Delete', async () => {
  // arrange
  const user = userEvent.setup();
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items: [groceries],
        total: 1,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']),
    ),
  );
  render(<Component />, { initialEntries: ['/categories'] });
  const variable = await screen.findByRole('region', { name: 'Variable' });
  await user.click(within(variable).getByRole('button', { name: 'Delete' }));
  const confirmation = screen.getByRole('alertdialog', { name: 'Delete this category?' });

  // act
  await user.click(within(confirmation).getByRole('button', { name: 'Cancel' }));

  // assert
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(within(variable).getByRole('button', { name: 'Delete' })).toHaveFocus();
});

test('restores a deleted category and moves the focus to its Edit', async () => {
  // arrange
  const user = userEvent.setup();
  let categories: components['schemas']['Account'][] = [groceries, cigarettes];
  let restorePath: string | undefined;
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items: categories,
        total: categories.length,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']),
    ),
    http.post('http://localhost/api/accounting/accounts/:accountId/restore', ({ request }) => {
      restorePath = new URL(request.url).pathname;
      const restored = {
        ...cigarettes,
        status: 'ACTIVE',
      } satisfies components['schemas']['Account'];
      categories = [groceries, restored];
      return HttpResponse.json(restored);
    }),
  );
  render(<Component />, { initialEntries: ['/categories'] });
  const variable = await screen.findByRole('region', { name: 'Variable' });

  // act
  await user.click(within(variable).getByRole('button', { name: 'Restore' }));

  // assert
  await waitFor(() => {
    expect(within(variable).queryByRole('button', { name: 'Restore' })).not.toBeInTheDocument();
  });
  expect(restorePath).toBe(`/api/accounting/accounts/${cigarettes.id}/restore`);
  expect(within(variable).queryByText('(deleted)', { exact: false })).not.toBeInTheDocument();
  await waitFor(() => {
    expect(within(variable).getAllByRole('button', { name: 'Edit' })[1]).toHaveFocus();
  });
});

test('opens Restore category when a restore is refused because the name is taken', async () => {
  // arrange
  const user = userEvent.setup();
  server.use(
    http.get('http://localhost/api/accounting/accounts', ({ request }) => {
      const items = new URL(request.url).searchParams.has('search_term')
        ? [{ ...cigarettes, id: '9e0f1a2b-4e6a-4c7d-8e9f-5a1d9c3e3c50', status: 'ACTIVE' as const }]
        : [cigarettes];
      return HttpResponse.json({
        items,
        total: items.length,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']);
    }),
    http.post(`http://localhost/api/accounting/accounts/${cigarettes.id}/restore`, () =>
      HttpResponse.json(
        {
          error_code: 'NAME_ALREADY_EXISTS',
          message: 'This name is already taken',
        } satisfies components['schemas']['ErrorResponse'],
        { status: 409 },
      ),
    ),
  );
  render(<Component />, { initialEntries: ['/categories'] });
  const variable = await screen.findByRole('region', { name: 'Variable' });

  // act
  await user.click(within(variable).getByRole('button', { name: 'Restore' }));

  // assert
  const restoreForm = await screen.findByRole('form', { name: 'Restore category' });
  const name = within(restoreForm).getByRole('textbox', { name: 'Name' });
  expect(name).toHaveValue('Cigarettes');
  await vi.waitFor(() => {
    expect(name).toHaveAccessibleDescription('An active category already has this name');
  });
  expect(screen.queryByText('Something went wrong. Please try again.')).not.toBeInTheDocument();
});

test('restores a category under a new name, closes the window and moves the focus to its Edit', async () => {
  // arrange
  const user = userEvent.setup();
  let categories: components['schemas']['Account'][] = [groceries, cigarettes];
  const restoreBodies: unknown[] = [];
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items: categories,
        total: categories.length,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']),
    ),
    http.post(
      `http://localhost/api/accounting/accounts/${cigarettes.id}/restore`,
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
        const restored = {
          ...cigarettes,
          name: 'Cigarettes 2025',
          status: 'ACTIVE',
        } satisfies components['schemas']['Account'];
        categories = [groceries, restored];
        return HttpResponse.json(restored);
      },
    ),
  );
  render(<Component />, { initialEntries: ['/categories'] });
  const variable = await screen.findByRole('region', { name: 'Variable' });
  await user.click(within(variable).getByRole('button', { name: 'Restore' }));
  const restoreForm = await screen.findByRole('form', { name: 'Restore category' });
  const name = within(restoreForm).getByRole('textbox', { name: 'Name' });
  await user.clear(name);
  await user.type(name, 'Cigarettes 2025');
  await vi.waitFor(() => {
    expect(within(restoreForm).getByRole('button', { name: 'Restore category' })).toBeEnabled();
  });

  // act
  await user.click(within(restoreForm).getByRole('button', { name: 'Restore category' }));

  // assert
  await waitFor(() => {
    expect(screen.queryByRole('form', { name: 'Restore category' })).not.toBeInTheDocument();
  });
  expect(restoreBodies).toEqual([{}, { name: 'Cigarettes 2025' }]);
  expect(within(variable).getByText('Cigarettes 2025')).toBeInTheDocument();
  expect(within(variable).queryByRole('button', { name: 'Restore' })).not.toBeInTheDocument();
  await waitFor(() => {
    expect(within(variable).getAllByRole('button', { name: 'Edit' })[1]).toHaveFocus();
  });
});

test('keeps Restore category closed after a category restored under a new name left the searched list', async () => {
  // arrange
  const user = userEvent.setup();
  let categories: components['schemas']['Account'][] = [groceries, cigarettes];
  let restoreCount = 0;
  server.use(
    http.get('http://localhost/api/accounting/accounts', ({ request }) => {
      const searchTerm = new URL(request.url).searchParams.get('search_term');
      const items = categories.filter(
        (category) =>
          searchTerm === null || category.name.toLowerCase().includes(searchTerm.toLowerCase()),
      );
      return HttpResponse.json({
        items,
        total: items.length,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']);
    }),
    http.post(`http://localhost/api/accounting/accounts/${cigarettes.id}/restore`, () => {
      restoreCount += 1;
      if (restoreCount === 1) {
        return HttpResponse.json(
          {
            error_code: 'NAME_ALREADY_EXISTS',
            message: 'This name is already taken',
          } satisfies components['schemas']['ErrorResponse'],
          { status: 409 },
        );
      }
      const restored = {
        ...cigarettes,
        name: 'Smokes',
        status: 'ACTIVE',
      } satisfies components['schemas']['Account'];
      categories = [groceries, restored];
      return HttpResponse.json(restored);
    }),
  );
  render(<Component />, { initialEntries: ['/categories?search=Cig'] });
  const variable = await screen.findByRole('region', { name: 'Variable' });
  await user.click(within(variable).getByRole('button', { name: 'Restore' }));
  const restoreForm = await screen.findByRole('form', { name: 'Restore category' });
  const name = within(restoreForm).getByRole('textbox', { name: 'Name' });
  await user.clear(name);
  await user.type(name, 'Smokes');
  await vi.waitFor(() => {
    expect(within(restoreForm).getByRole('button', { name: 'Restore category' })).toBeEnabled();
  });
  await user.click(within(restoreForm).getByRole('button', { name: 'Restore category' }));
  expect(await screen.findByText('No categories match this search')).toBeInTheDocument();

  // act
  await user.click(screen.getByRole('button', { name: 'Clear search' }));

  // assert
  expect(await screen.findByRole('region', { name: 'Variable' })).toHaveTextContent('Smokes');
  expect(screen.getByRole('searchbox', { name: 'Search categories' })).toHaveFocus();
  expect(screen.queryByRole('form', { name: 'Restore category' })).not.toBeInTheDocument();
});

test('closes Restore category on Back and leaves the category deleted', async () => {
  // arrange
  const user = userEvent.setup();
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items: [cigarettes],
        total: 1,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']),
    ),
    http.post(`http://localhost/api/accounting/accounts/${cigarettes.id}/restore`, () =>
      HttpResponse.json(
        {
          error_code: 'NAME_ALREADY_EXISTS',
          message: 'This name is already taken',
        } satisfies components['schemas']['ErrorResponse'],
        { status: 409 },
      ),
    ),
  );
  render(<Component />, { initialEntries: ['/categories'] });
  const variable = await screen.findByRole('region', { name: 'Variable' });
  await user.click(within(variable).getByRole('button', { name: 'Restore' }));
  const restoreForm = await screen.findByRole('form', { name: 'Restore category' });

  // act
  await user.click(within(restoreForm).getByRole('button', { name: 'Back' }));

  // assert
  expect(screen.queryByRole('form', { name: 'Restore category' })).not.toBeInTheDocument();
  expect(within(variable).getByRole('button', { name: 'Restore' })).toBeInTheDocument();
});

test('shows the error notification when a restore fails for another reason', async () => {
  // arrange
  const user = userEvent.setup();
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items: [cigarettes],
        total: 1,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']),
    ),
    http.post(`http://localhost/api/accounting/accounts/${cigarettes.id}/restore`, () =>
      HttpResponse.json(
        {
          error_code: 'ENTITY_NOT_FOUND',
          message: 'Account not found',
        } satisfies components['schemas']['ErrorResponse'],
        { status: 404 },
      ),
    ),
  );
  render(<Component />, { initialEntries: ['/categories'] });
  const variable = await screen.findByRole('region', { name: 'Variable' });

  // act
  await user.click(within(variable).getByRole('button', { name: 'Restore' }));

  // assert
  expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
  expect(screen.queryByRole('form', { name: 'Restore category' })).not.toBeInTheDocument();
});

test('keeps the edit form closed after a saved category left the filtered list', async () => {
  // arrange
  const user = userEvent.setup();
  let categories: components['schemas']['Account'][] = [groceries, rent];
  server.use(
    http.get('http://localhost/api/accounting/accounts', ({ request }) => {
      const types = new URL(request.url).searchParams.getAll('category_types');
      const items = categories.filter(
        (category) => types.length === 0 || types.includes(category.category_type ?? ''),
      );
      return HttpResponse.json({
        items,
        total: items.length,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']);
    }),
    http.put(`http://localhost/api/accounting/accounts/${rent.id}`, () => {
      const periodicRent = {
        ...rent,
        category_type: 'PERIODIC',
      } satisfies components['schemas']['Account'];
      categories = [groceries, periodicRent];
      return HttpResponse.json(periodicRent);
    }),
  );
  render(<Component />, { initialEntries: ['/categories?category_type=FIXED'] });
  const fixed = await screen.findByRole('region', { name: 'Fixed' });
  await user.click(within(fixed).getByRole('button', { name: 'Edit' }));
  const form = await screen.findByRole('form', { name: 'Edit category' });
  await user.click(within(form).getByRole('radio', { name: 'Periodic' }));
  await vi.waitFor(() => {
    expect(within(form).getByRole('button', { name: 'Save changes' })).toBeEnabled();
  });
  await user.click(within(form).getByRole('button', { name: 'Save changes' }));
  await waitFor(() => {
    expect(screen.queryByRole('form', { name: 'Edit category' })).not.toBeInTheDocument();
  });

  // act
  await user.click(screen.getByRole('radio', { name: 'All' }));

  // assert
  expect(await screen.findByRole('region', { name: 'Periodic' })).toHaveTextContent('Rent');
  expect(screen.queryByRole('form', { name: 'Edit category' })).not.toBeInTheDocument();
});

test('moves the focus to Restore of the row when its deletion fails because it is already deleted', async () => {
  // arrange
  const user = userEvent.setup();
  let categories: components['schemas']['Account'][] = [groceries, rent];
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items: categories,
        total: categories.length,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']),
    ),
    http.delete(`http://localhost/api/accounting/accounts/${groceries.id}`, () => {
      categories = [{ ...groceries, status: 'DELETED' }, rent];
      return HttpResponse.json(
        { message: 'Account not found' } satisfies components['schemas']['ErrorResponse'],
        { status: 404 },
      );
    }),
  );
  render(<Component />, { initialEntries: ['/categories'] });
  const variable = await screen.findByRole('region', { name: 'Variable' });
  await user.click(within(variable).getByRole('button', { name: 'Delete' }));
  const confirmation = screen.getByRole('alertdialog', { name: 'Delete this category?' });

  // act
  await user.click(within(confirmation).getByRole('button', { name: 'Delete' }));

  // assert
  await waitFor(() => {
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
  await waitFor(() => {
    expect(within(variable).getByRole('button', { name: 'Restore' })).toHaveFocus();
  });
  expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument();
});

test('keeps the edit form of another category open when an earlier save finishes', async () => {
  // arrange
  const user = userEvent.setup();
  let categories: components['schemas']['Account'][] = [groceries, rent];
  let finishSave = (): void => undefined;
  const saveFinished = new Promise<void>((resolve) => {
    finishSave = resolve;
  });
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items: categories,
        total: categories.length,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']),
    ),
    http.put(`http://localhost/api/accounting/accounts/${rent.id}`, async () => {
      await saveFinished;
      const flat = { ...rent, name: 'Flat' } satisfies components['schemas']['Account'];
      categories = [groceries, flat];
      return HttpResponse.json(flat);
    }),
  );
  render(<Component />, { initialEntries: ['/categories'] });
  const fixed = await screen.findByRole('region', { name: 'Fixed' });
  await user.click(within(fixed).getByRole('button', { name: 'Edit' }));
  const rentForm = await screen.findByRole('form', { name: 'Edit category' });
  await vi.waitFor(() => {
    expect(within(rentForm).getByRole('button', { name: 'Save changes' })).toBeEnabled();
  });
  await user.click(within(rentForm).getByRole('button', { name: 'Save changes' }));
  await user.click(within(rentForm).getByRole('button', { name: 'Back' }));
  await user.click(
    within(screen.getByRole('region', { name: 'Variable' })).getByRole('button', { name: 'Edit' }),
  );
  const groceriesForm = await screen.findByRole('form', { name: 'Edit category' });

  // act
  finishSave();

  // assert
  await waitFor(() => {
    expect(screen.getByRole('region', { name: 'Fixed' })).toHaveTextContent('Flat');
  });
  expect(groceriesForm).toBeInTheDocument();
  expect(within(groceriesForm).getByRole('textbox', { name: 'Name' })).toHaveValue('Groceries');
});

test('shows the transactions of the top category beside the list while none is chosen', async () => {
  // arrange
  const requestedAccountIds: string[] = [];
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items: [rent, groceries],
        total: 2,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']),
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
  const { router } = render(<Component />, { initialEntries: ['/categories'] });

  // assert
  const transactions = await screen.findByRole('region', { name: 'Transactions of Groceries' });
  expect(within(transactions).getByRole('heading', { name: 'Groceries' })).toBeInTheDocument();
  expect(
    within(transactions).getByText('Category · Variable · recent transactions'),
  ).toBeInTheDocument();
  expect(within(transactions).getByRole('link', { name: 'All' })).toHaveAttribute(
    'href',
    `/transactions?category_ids=${groceries.id}`,
  );
  expect(
    await within(transactions).findByText('No transactions in this category yet'),
  ).toBeInTheDocument();
  expect(requestedAccountIds).toEqual([groceries.id]);
  expect(screen.getByRole('link', { name: 'Groceries' })).not.toHaveAttribute('aria-current');
  expect(router.state.location.search).toBe('');
});

test('shows the transactions of the category whose name is chosen and moves the choice with the arrow keys', async () => {
  // arrange
  const user = userEvent.setup();
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items: [groceries, cigarettes, rent],
        total: 3,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']),
    ),
    http.get('http://localhost/api/accounting/transactions', ({ request }) => {
      const items =
        new URL(request.url).searchParams.getAll('account_ids').join() === rent.id
          ? [rentPayment]
          : [];
      return HttpResponse.json({
        items,
        total: items.length,
        page: 1,
        size: 15,
        pages: 1,
      } satisfies components['schemas']['Page_Transaction_']);
    }),
  );
  const { router } = render(<Component />, { initialEntries: ['/categories'] });

  // act
  await user.click(await screen.findByRole('link', { name: 'Rent' }));

  // assert
  const rentTransactions = await screen.findByRole('region', { name: 'Transactions of Rent' });
  expect(
    within(rentTransactions).getByText('Category · Fixed · recent transactions'),
  ).toBeInTheDocument();
  // the day's total and the payment itself
  expect(await within(rentTransactions).findAllByText('-$900.00')).toHaveLength(2);
  expect(within(rentTransactions).getAllByRole('link')).toHaveLength(1);
  expect(screen.queryByRole('dialog', { name: 'Transaction details' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Rent' })).toHaveAttribute('aria-current', 'true');
  expect(new URLSearchParams(router.state.location.search).get('account')).toBe(rent.id);

  // act
  await user.keyboard('{ArrowUp}');

  // assert
  expect(
    await screen.findByRole('region', { name: 'Transactions of Cigarettes' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Cigarettes (deleted)' })).toHaveFocus();
  expect(new URLSearchParams(router.state.location.search).get('account')).toBe(cigarettes.id);
});

test('shows the details of the top transaction beside the transactions of a category whose rows name the account on a wide desktop', async () => {
  // arrange
  const user = userEvent.setup();
  vi.stubGlobal('innerWidth', 1280);
  server.use(
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
        ],
        transaction_types: [{ key: 'EXPENSE', label: 'Expense' }],
        transaction_orders: [],
      } satisfies components['schemas']['AccountingDictionaries']),
    ),
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items: [groceries, rent],
        total: 2,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']),
    ),
    http.get('http://localhost/api/accounting/transactions', ({ request }) => {
      const items =
        new URL(request.url).searchParams.getAll('account_ids').join() === rent.id
          ? [rentPayment, earlierRentPayment]
          : [];
      return HttpResponse.json({
        items,
        total: items.length,
        page: 1,
        size: 15,
        pages: 1,
      } satisfies components['schemas']['Page_Transaction_']);
    }),
    http.get('http://localhost/api/accounting/transactions/:transactionId', ({ params }) =>
      HttpResponse.json(
        params['transactionId'] === rentPayment.id ? rentPayment : earlierRentPayment,
      ),
    ),
  );
  const { router } = render(<Component />, { initialEntries: [`/categories?account=${rent.id}`] });

  // assert
  const transactionDetails = await screen.findByRole('dialog', { name: 'Transaction details' });
  expect(await within(transactionDetails).findAllByText('-$900.00')).not.toHaveLength(0);
  expect(within(transactionDetails).getByRole('link', { name: 'Main card' })).toHaveAttribute(
    'href',
    `/accounts?account=${mainCardPosting?.account.id ?? ''}`,
  );
  // the category of the page is plain text in the postings
  expect(within(transactionDetails).queryByRole('link', { name: 'Rent' })).not.toBeInTheDocument();
  expect(screen.queryByRole('dialog', { name: 'Account details' })).not.toBeInTheDocument();
  expect(router.state.location.search).toBe(`?account=${rent.id}`);

  // act
  const rentTransactions = screen.getByRole('region', { name: 'Transactions of Rent' });
  const [, earlierRow] = await within(rentTransactions).findAllByRole('link', {
    name: 'Main card',
  });
  if (earlierRow === undefined) {
    throw new Error('Both payments have a row.');
  }

  await user.click(earlierRow);

  // assert
  expect(await within(transactionDetails).findAllByText('-$850.00')).not.toHaveLength(0);
  expect(new URLSearchParams(router.state.location.search).get('transaction')).toBe(
    earlierRentPayment.id,
  );
  expect(new URLSearchParams(router.state.location.search).get('account')).toBe(rent.id);

  // act
  await user.keyboard('{ArrowUp}');

  // assert
  await waitFor(() => {
    expect(new URLSearchParams(router.state.location.search).get('transaction')).toBe(
      rentPayment.id,
    );
  });
  expect(new URLSearchParams(router.state.location.search).get('account')).toBe(rent.id);

  // act
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }

  await user.keyboard('{ArrowUp}');

  // assert
  expect(
    await screen.findByRole('region', { name: 'Transactions of Groceries' }),
  ).toBeInTheDocument();
  expect(router.state.location.search).toBe(`?account=${groceries.id}`);
});

test('moves the focus between the category and its top transaction with Left and Right on a wide desktop', async () => {
  // arrange
  const user = userEvent.setup();
  vi.stubGlobal('innerWidth', 1280);
  server.use(
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
        ],
        transaction_types: [{ key: 'EXPENSE', label: 'Expense' }],
        transaction_orders: [],
      } satisfies components['schemas']['AccountingDictionaries']),
    ),
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items: [groceries, rent],
        total: 2,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']),
    ),
    http.get('http://localhost/api/accounting/transactions', ({ request }) => {
      const items =
        new URL(request.url).searchParams.getAll('account_ids').join() === rent.id
          ? [rentPayment, earlierRentPayment]
          : [];
      return HttpResponse.json({
        items,
        total: items.length,
        page: 1,
        size: 15,
        pages: 1,
      } satisfies components['schemas']['Page_Transaction_']);
    }),
    http.get('http://localhost/api/accounting/transactions/:transactionId', ({ params }) =>
      HttpResponse.json(
        params['transactionId'] === rentPayment.id ? rentPayment : earlierRentPayment,
      ),
    ),
  );
  const { router } = render(<Component />, { initialEntries: [`/categories?account=${rent.id}`] });
  const rentTransactions = await screen.findByRole('region', { name: 'Transactions of Rent' });
  const [topRow] = await within(rentTransactions).findAllByRole('link', { name: 'Main card' });

  // act
  await user.keyboard('{ArrowRight}');

  // assert
  expect(topRow).toHaveFocus();

  // act
  await user.keyboard('{ArrowLeft}');

  // assert
  expect(screen.getByRole('link', { name: 'Rent' })).toHaveFocus();
  expect(router.state.location.search).toBe(`?account=${rent.id}`);

  // act
  const searchField = screen.getByRole('searchbox', { name: 'Search categories' });
  await user.click(searchField);
  await user.keyboard('{ArrowRight}');

  // assert
  expect(searchField).toHaveFocus();

  // act
  await user.click(
    within(screen.getByRole('region', { name: 'Fixed' })).getByRole('button', { name: 'Delete' }),
  );
  const confirmation = screen.getByRole('alertdialog', { name: 'Delete this category?' });
  const focusedButton = document.activeElement;
  await user.keyboard('{ArrowRight}');

  // assert
  expect(confirmation).toContainElement(
    focusedButton instanceof HTMLElement ? focusedButton : null,
  );
  expect(focusedButton).toHaveFocus();
});

test('leaves the focus with Left and Right beside transactions without details on a narrower desktop', async () => {
  // arrange
  const user = userEvent.setup();
  vi.stubGlobal('innerWidth', 1024);
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items: [groceries, rent],
        total: 2,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']),
    ),
    http.get('http://localhost/api/accounting/transactions', () =>
      HttpResponse.json({
        items: [rentPayment],
        total: 1,
        page: 1,
        size: 15,
        pages: 1,
      } satisfies components['schemas']['Page_Transaction_']),
    ),
  );
  render(<Component />, { initialEntries: [`/categories?account=${rent.id}`] });
  const rentTransactions = await screen.findByRole('region', { name: 'Transactions of Rent' });
  expect(await within(rentTransactions).findAllByText('-$900.00')).not.toHaveLength(0);

  // act
  await user.keyboard('{ArrowLeft}{ArrowRight}');

  // assert
  expect(document.body).toHaveFocus();
});

test('drops the chosen transaction when the type filter or Deleted changes the list', async () => {
  // arrange
  const user = userEvent.setup();
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items: [groceries, rent],
        total: 2,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']),
    ),
  );
  const { router } = render(<Component />, {
    initialEntries: [`/categories?account=${rent.id}&transaction=${rentPayment.id}`],
  });

  // act
  await user.click(await screen.findByRole('radio', { name: 'Fixed' }));

  // assert
  await waitFor(() => {
    expect(new URLSearchParams(router.state.location.search).get('transaction')).toBeNull();
  });
  expect(new URLSearchParams(router.state.location.search).get('account')).toBe(rent.id);

  // act
  await router.navigate(`/categories?account=${rent.id}&transaction=${rentPayment.id}`);
  await user.click(screen.getByRole('switch', { name: 'Deleted' }));

  // assert
  await waitFor(() => {
    expect(new URLSearchParams(router.state.location.search).get('transaction')).toBeNull();
  });
});

test('keeps the chosen category when the keys are pressed in the details of a transaction the feed has not loaded', async () => {
  // arrange
  const user = userEvent.setup();
  vi.stubGlobal('innerWidth', 1280);
  server.use(
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
        ],
        transaction_types: [{ key: 'EXPENSE', label: 'Expense' }],
        transaction_orders: [],
      } satisfies components['schemas']['AccountingDictionaries']),
    ),
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items: [groceries, rent],
        total: 2,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']),
    ),
    // the feed's first page holds only the latest payment
    http.get('http://localhost/api/accounting/transactions', () =>
      HttpResponse.json({
        items: [rentPayment],
        total: 2,
        page: 1,
        size: 15,
        pages: 2,
      } satisfies components['schemas']['Page_Transaction_']),
    ),
    http.get(`http://localhost/api/accounting/transactions/${earlierRentPayment.id}`, () =>
      HttpResponse.json(earlierRentPayment),
    ),
  );
  const { router } = render(<Component />, {
    initialEntries: [`/categories?account=${rent.id}&transaction=${earlierRentPayment.id}`],
  });
  const transactionDetails = await screen.findByRole('dialog', { name: 'Transaction details' });
  await within(transactionDetails).findAllByText('-$850.00');
  transactionDetails.focus();

  // act
  await user.keyboard('{ArrowUp}');

  // assert
  const searchParams = new URLSearchParams(router.state.location.search);
  expect(searchParams.get('account')).toBe(rent.id);
  expect(searchParams.get('transaction')).toBe(earlierRentPayment.id);
});

test('drops a chosen transaction that is not of the shown category on a wide desktop', async () => {
  // arrange
  vi.stubGlobal('innerWidth', 1280);
  server.use(
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
        ],
        transaction_types: [{ key: 'EXPENSE', label: 'Expense' }],
        transaction_orders: [],
      } satisfies components['schemas']['AccountingDictionaries']),
    ),
    // Rent has left the list, so Groceries is shown
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items: [groceries],
        total: 1,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']),
    ),
    http.get(`http://localhost/api/accounting/transactions/${rentPayment.id}`, () =>
      HttpResponse.json(rentPayment),
    ),
  );

  // act
  const { router } = render(<Component />, {
    initialEntries: [`/categories?account=${rent.id}&transaction=${rentPayment.id}`],
  });

  // assert
  expect(
    await screen.findByRole('region', { name: 'Transactions of Groceries' }),
  ).toBeInTheDocument();
  await waitFor(() => {
    expect(new URLSearchParams(router.state.location.search).get('transaction')).toBeNull();
  });
  expect(screen.queryByRole('dialog', { name: 'Transaction details' })).not.toBeInTheDocument();
});

test('gives a phone plain names and no transactions of a category', async () => {
  // arrange
  vi.stubGlobal('innerWidth', 390);
  let transactionRequestCount = 0;
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items: [groceries, rent],
        total: 2,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']),
    ),
    http.get('http://localhost/api/accounting/transactions', () => {
      transactionRequestCount += 1;
      return HttpResponse.json(null, { status: 400 });
    }),
  );

  // act
  render(<Component />, { initialEntries: [`/categories?account=${rent.id}`] });

  // assert
  const variable = await screen.findByRole('region', { name: 'Variable' });
  expect(within(variable).getByText('Groceries')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Groceries' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Rent' })).not.toBeInTheDocument();
  expect(screen.queryByRole('region', { name: /^Transactions of/ })).not.toBeInTheDocument();
  expect(transactionRequestCount).toBe(0);
});

test('shows an empty state instead of the list when there are no categories', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items: [],
        total: 0,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']),
    ),
  );

  // act
  render(<Component />, { initialEntries: ['/categories'] });

  // assert
  expect(await screen.findByText('No categories yet')).toBeInTheDocument();
  expect(screen.getByText('Add what you spend on, like groceries or rent.')).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Categories' })).not.toBeInTheDocument();
});

test.each([
  { action: 'Edit', entry: groceries, role: 'form', sheetName: 'Edit category' },
  { action: 'Delete', entry: groceries, role: 'alertdialog', sheetName: 'Delete this category?' },
  { action: 'Restore', entry: cigarettes, role: 'form', sheetName: 'Restore category' },
] as const)(
  'keeps $sheetName closed when its category comes back after a search hid it',
  async ({ action, entry, role, sheetName }) => {
    // arrange
    const user = userEvent.setup();
    server.use(
      http.get('http://localhost/api/accounting/accounts', ({ request }) => {
        const searchTerm = new URL(request.url).searchParams.get('search_term');
        const items = searchTerm === null ? [entry] : [rent];
        return HttpResponse.json({
          items,
          total: items.length,
          page: 1,
          size: 100,
          pages: 1,
        } satisfies components['schemas']['Page_Account_']);
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
    const { router } = render(<Component />, { initialEntries: ['/categories'] });
    const list = await screen.findByRole('region', { name: 'Variable' });
    await user.click(await within(list).findByRole('button', { name: action }));
    expect(await screen.findByRole(role, { name: sheetName })).toBeInTheDocument();
    await act(() => router.navigate('/categories?search=Rent'));
    await waitFor(() => {
      expect(screen.queryByRole(role, { name: sheetName })).not.toBeInTheDocument();
    });

    // act
    await act(() => router.navigate(-1));

    // assert
    expect(await screen.findByRole('region', { name: 'Variable' })).toHaveTextContent(entry.name);
    expect(screen.queryByRole(role, { name: sheetName })).not.toBeInTheDocument();
  },
);
