import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, expect, test } from 'vitest';

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

beforeEach(() => {
  server.use(
    http.get('http://localhost/api/dictionaries/accounting', () =>
      HttpResponse.json({
        currencies: [],
        account_kinds: [],
        category_types: [
          { key: 'VARIABLE', label: 'Variable' },
          { key: 'FIXED', label: 'Fixed' },
          { key: 'PERIODIC', label: 'Periodic' },
        ],
        transaction_types: [],
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

  // act
  await user.click(within(form).getByRole('button', { name: 'Create category' }));

  // assert
  expect(await screen.findByRole('region', { name: 'Fixed' })).toHaveTextContent('Rent');
  expect(screen.queryByRole('form', { name: 'New category' })).not.toBeInTheDocument();
  expect(createdBody).toMatchObject({ name: 'Rent', kind: 'EXPENSE', category_type: 'FIXED' });
});

test('gives an active row Transactions, Edit and Delete and a deleted one Restore', async () => {
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
  expect(within(cigarettesRow).queryByRole('link')).not.toBeInTheDocument();
  expect(within(cigarettesRow).getAllByRole('button')).toHaveLength(1);
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
    within(screen.getByRole('region', { name: 'Fixed' })).getByRole('link', {
      name: 'Transactions',
    }),
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

test('restores a deleted category and moves the focus to its Transactions', async () => {
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
    expect(within(variable).getAllByRole('link', { name: 'Transactions' })[1]).toHaveFocus();
  });
});

test('shows the error notification when a restore is refused because the name is taken', async () => {
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

  // act
  await user.click(within(variable).getByRole('button', { name: 'Restore' }));

  // assert
  expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
  expect(within(variable).getByRole('button', { name: 'Restore' })).toBeEnabled();
});
