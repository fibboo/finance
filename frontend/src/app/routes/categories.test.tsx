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

function readCategoryPage(
  categories: readonly components['schemas']['Account'][],
): components['schemas']['Page_Account_'] {
  const categoryPage = {
    items: [...categories],
    total: categories.length,
    page: 1,
    size: 100,
    pages: 1,
  };
  return categoryPage;
}

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
      return HttpResponse.json(
        readCategoryPage(
          statuses.includes('DELETED') ? [groceries, cigarettes, rent] : [groceries, rent],
        ),
      );
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
      return HttpResponse.json(
        readCategoryPage(
          query.getAll('category_types').includes('FIXED') ? [rent] : [groceries, rent],
        ),
      );
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
      return HttpResponse.json(readCategoryPage([groceries]));
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
      return HttpResponse.json(readCategoryPage(searchTerm === null ? [groceries, rent] : []));
    }),
  );
  render(<Component />, { initialEntries: ['/categories'] });
  await screen.findByRole('region', { name: 'Variable' });
  const searchField = screen.getByRole('searchbox', { name: 'Search categories' });
  await user.type(searchField, 'zz');
  expect(requestedTerms).not.toContain('zz');
  await user.type(searchField, 'z');
  expect(await screen.findByText('No categories match this search')).toBeInTheDocument();

  // act
  await user.click(screen.getByRole('button', { name: 'Clear search' }));

  // assert
  expect(await screen.findByRole('region', { name: 'Variable' })).toBeInTheDocument();
  const clearedField = screen.getByRole('searchbox', { name: 'Search categories' });
  expect(clearedField).toHaveValue('');
  expect(clearedField).toHaveFocus();
});

test('creates a category from New category and lists it', async () => {
  // arrange
  const user = userEvent.setup();
  let categories: components['schemas']['Account'][] = [groceries];
  let createdBody: unknown;
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json(readCategoryPage(categories)),
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
