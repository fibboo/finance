import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, expect, test, vi } from 'vitest';

import type { components } from '@/lib/api-schema';
import { render } from '@/test/render';
import { server } from '@/test/setup';

import { Component } from './locations';

const spar = {
  name: 'Spar',
  description: 'Near home',
  id: '4a52f0e1-1d7b-4a52-9f3a-0b5c1f0e8d44',
  user_id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
  status: 'ACTIVE',
  created_at: '2026-10-01T09:00:00Z',
  updated_at: '2026-10-01T09:00:00Z',
} satisfies components['schemas']['Location'];

const coffeeLab = {
  ...spar,
  name: 'Coffee Lab',
  description: null,
  id: '1d7b4a52-f0e1-4a52-9f3a-0b5c1f0e8d45',
} satisfies components['schemas']['Location'];

const oldMarket = {
  ...spar,
  name: 'Old market',
  description: 'Closed in spring',
  id: '1d7b4a52-f0e1-4a52-9f3a-0b5c1f0e8d46',
  status: 'DELETED',
} satisfies components['schemas']['Location'];

function readLocationPage(
  items: readonly components['schemas']['Location'][],
): components['schemas']['Page_Location_'] {
  const locationPage = { items: [...items], total: items.length, page: 1, size: 100, pages: 1 };
  return locationPage;
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
        category_types: [],
        transaction_types: [{ key: 'EXPENSE', label: 'Expense' }],
        transaction_orders: [],
      } satisfies components['schemas']['AccountingDictionaries']),
    ),
  );
});

test('shows the number of active locations and lists them by recent use with the deleted ones', async () => {
  // arrange
  const requestedOrders: string[] = [];
  server.use(
    http.get('http://localhost/api/accounting/locations', ({ request }) => {
      const query = new URL(request.url).searchParams;
      requestedOrders.push(query.get('order') ?? '');
      const items = query.getAll('statuses').includes('DELETED')
        ? [spar, coffeeLab, oldMarket]
        : [spar, coffeeLab];
      return HttpResponse.json(readLocationPage(items));
    }),
  );

  // act
  render(<Component />, { initialEntries: ['/locations'] });

  // assert
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Locations, 2 locations' }),
  ).toBeInTheDocument();
  const list = await screen.findByRole('region', { name: 'Locations' });
  await within(list).findByText('Spar');
  expect(within(list).getAllByRole('listitem')).toHaveLength(3);
  expect(within(list).getByText('Near home')).toBeInTheDocument();
  expect(within(list).getByText('(deleted)', { exact: false }).closest('s')).toHaveTextContent(
    'Old market',
  );
  expect(screen.getByRole('switch', { name: 'Deleted' })).toBeChecked();
  expect(new Set(requestedOrders)).toEqual(new Set(['recent_use']));
});

test('requests only the active locations with Deleted off and keeps it in the URL', async () => {
  // arrange
  const user = userEvent.setup();
  const requestedStatuses: string[] = [];
  server.use(
    http.get('http://localhost/api/accounting/locations', ({ request }) => {
      const statuses = new URL(request.url).searchParams.getAll('statuses');
      requestedStatuses.push(statuses.join());
      const items = statuses.includes('DELETED') ? [spar, oldMarket] : [spar];
      return HttpResponse.json(readLocationPage(items));
    }),
  );
  const { router } = render(<Component />, { initialEntries: ['/locations'] });
  const list = await screen.findByRole('region', { name: 'Locations' });
  expect(await within(list).findByText('Old market')).toBeInTheDocument();

  // act
  await user.click(screen.getByRole('switch', { name: 'Deleted' }));

  // assert
  await waitFor(() => {
    expect(within(list).queryByText('Old market')).not.toBeInTheDocument();
  });
  expect(requestedStatuses).toContain('ACTIVE');
  expect(new URLSearchParams(router.state.location.search).get('deleted')).toBe('off');
});

test('requests the search term and offers to clear a search that matches nothing', async () => {
  // arrange
  const user = userEvent.setup();
  const requestedTerms: string[] = [];
  server.use(
    http.get('http://localhost/api/accounting/locations', ({ request }) => {
      const searchTerm = new URL(request.url).searchParams.get('search_term');
      requestedTerms.push(searchTerm ?? '');
      return HttpResponse.json(readLocationPage(searchTerm === null ? [spar] : []));
    }),
  );
  render(<Component />, { initialEntries: ['/locations?search=zoo'] });
  expect(await screen.findByText('No locations match this search')).toBeInTheDocument();

  // act
  await user.click(screen.getByRole('button', { name: 'Clear search' }));

  // assert
  const list = await screen.findByRole('region', { name: 'Locations' });
  expect(await within(list).findByText('Spar')).toBeInTheDocument();
  expect(requestedTerms).toContain('zoo');
});

test('gives an active row Transactions, Edit and Delete and a deleted one Restore', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/accounting/locations', () =>
      HttpResponse.json(readLocationPage([spar, oldMarket])),
    ),
  );

  // act
  render(<Component />, { initialEntries: ['/locations'] });

  // assert
  const list = await screen.findByRole('region', { name: 'Locations' });
  await within(list).findByText('Spar');
  const [sparRow, oldMarketRow] = within(list).getAllByRole('listitem');
  if (sparRow === undefined || oldMarketRow === undefined) {
    throw new Error('Both locations have a row.');
  }

  expect(within(sparRow).getByRole('link', { name: 'Transactions' })).toHaveAttribute(
    'href',
    `/transactions?location_ids=${spar.id}`,
  );
  expect(within(sparRow).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  expect(within(sparRow).getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  expect(within(oldMarketRow).getAllByRole('button')).toHaveLength(1);
  expect(within(oldMarketRow).getByRole('button', { name: 'Restore' })).toBeInTheDocument();
});

test('creates a location from New location and lists it', async () => {
  // arrange
  const user = userEvent.setup();
  let locations: components['schemas']['Location'][] = [spar];
  let createdBody: unknown;
  server.use(
    http.get('http://localhost/api/accounting/locations', () =>
      HttpResponse.json(readLocationPage(locations)),
    ),
    http.post('http://localhost/api/accounting/locations', async ({ request }) => {
      createdBody = await request.json();
      locations = [spar, coffeeLab];
      return HttpResponse.json(coffeeLab, { status: 201 });
    }),
  );
  render(<Component />, { initialEntries: ['/locations'] });
  const list = await screen.findByRole('region', { name: 'Locations' });
  await within(list).findByText('Spar');
  await user.click(screen.getByRole('button', { name: 'New location' }));
  const form = await screen.findByRole('form', { name: 'New location' });
  await user.type(within(form).getByRole('textbox', { name: 'Name' }), 'Coffee Lab');

  // act
  await user.click(within(form).getByRole('button', { name: 'Create location' }));

  // assert
  expect(await within(list).findByText('Coffee Lab')).toBeInTheDocument();
  expect(screen.queryByRole('form', { name: 'New location' })).not.toBeInTheDocument();
  expect(createdBody).toEqual({ name: 'Coffee Lab', description: null });
});

test('edits a location from its row and lists the saved name', async () => {
  // arrange
  const user = userEvent.setup();
  let locations: components['schemas']['Location'][] = [spar];
  let updatedBody: unknown;
  server.use(
    http.get('http://localhost/api/accounting/locations', () =>
      HttpResponse.json(readLocationPage(locations)),
    ),
    http.put(`http://localhost/api/accounting/locations/${spar.id}`, async ({ request }) => {
      updatedBody = await request.json();
      const saved = { ...spar, name: 'Spar Express' } satisfies components['schemas']['Location'];
      locations = [saved];
      return HttpResponse.json(saved);
    }),
  );
  render(<Component />, { initialEntries: ['/locations'] });
  const list = await screen.findByRole('region', { name: 'Locations' });
  await user.click(await within(list).findByRole('button', { name: 'Edit' }));
  const form = await screen.findByRole('form', { name: 'Edit location' });
  const name = within(form).getByRole('textbox', { name: 'Name' });
  await user.clear(name);
  await user.type(name, 'Spar Express');

  // act
  await user.click(within(form).getByRole('button', { name: 'Save changes' }));

  // assert
  expect(await within(list).findByText('Spar Express')).toBeInTheDocument();
  expect(screen.queryByRole('form', { name: 'Edit location' })).not.toBeInTheDocument();
  expect(updatedBody).toEqual({ name: 'Spar Express', description: 'Near home' });
});

test('shows a taken name at the Name field of Edit location', async () => {
  // arrange
  const user = userEvent.setup();
  server.use(
    http.get('http://localhost/api/accounting/locations', () =>
      HttpResponse.json(readLocationPage([spar])),
    ),
    http.put(`http://localhost/api/accounting/locations/${spar.id}`, () =>
      HttpResponse.json(
        {
          error_code: 'NAME_ALREADY_EXISTS',
          message: 'This name is already taken',
        } satisfies components['schemas']['ErrorResponse'],
        { status: 409 },
      ),
    ),
  );
  render(<Component />, { initialEntries: ['/locations'] });
  const list = await screen.findByRole('region', { name: 'Locations' });
  await user.click(await within(list).findByRole('button', { name: 'Edit' }));
  const form = await screen.findByRole('form', { name: 'Edit location' });

  // act
  await user.click(within(form).getByRole('button', { name: 'Save changes' }));

  // assert
  await waitFor(() => {
    expect(within(form).getByRole('textbox', { name: 'Name' })).toHaveAccessibleDescription(
      'This name is already taken',
    );
  });
});

test('deletes a location after the confirmation', async () => {
  // arrange
  const user = userEvent.setup();
  let locations: components['schemas']['Location'][] = [spar, coffeeLab];
  let deletedId: unknown;
  server.use(
    http.get('http://localhost/api/accounting/locations', () =>
      HttpResponse.json(readLocationPage(locations)),
    ),
    http.delete('http://localhost/api/accounting/locations/:locationId', ({ params }) => {
      deletedId = params['locationId'];
      locations = [coffeeLab];
      return HttpResponse.json({ ...spar, status: 'DELETED' });
    }),
  );
  render(<Component />, { initialEntries: ['/locations'] });
  const list = await screen.findByRole('region', { name: 'Locations' });
  await within(list).findByText('Spar');
  const [sparRow] = within(list).getAllByRole('listitem');
  if (sparRow === undefined) {
    throw new Error('Spar has a row.');
  }

  await user.click(within(sparRow).getByRole('button', { name: 'Delete' }));
  const confirmation = await screen.findByRole('alertdialog', { name: 'Delete this location?' });

  // act
  await user.click(within(confirmation).getByRole('button', { name: 'Delete' }));

  // assert
  await waitFor(() => {
    expect(within(list).queryByText('Spar')).not.toBeInTheDocument();
  });
  expect(deletedId).toBe(spar.id);
});

test('restores a deleted location from its row', async () => {
  // arrange
  const user = userEvent.setup();
  let locations: components['schemas']['Location'][] = [oldMarket];
  let restoreCount = 0;
  server.use(
    http.get('http://localhost/api/accounting/locations', () =>
      HttpResponse.json(readLocationPage(locations)),
    ),
    http.post(`http://localhost/api/accounting/locations/${oldMarket.id}/restore`, () => {
      restoreCount += 1;
      const restored = {
        ...oldMarket,
        status: 'ACTIVE',
      } satisfies components['schemas']['Location'];
      locations = [restored];
      return HttpResponse.json(restored);
    }),
  );
  render(<Component />, { initialEntries: ['/locations'] });
  const list = await screen.findByRole('region', { name: 'Locations' });

  // act
  await user.click(await within(list).findByRole('button', { name: 'Restore' }));

  // assert
  expect(await within(list).findByRole('button', { name: 'Edit' })).toBeInTheDocument();
  expect(restoreCount).toBe(1);
});

test('opens Restore location when a restore is refused because the name is taken', async () => {
  // arrange
  const user = userEvent.setup();
  server.use(
    http.get('http://localhost/api/accounting/locations', () =>
      HttpResponse.json(readLocationPage([oldMarket])),
    ),
    http.post(`http://localhost/api/accounting/locations/${oldMarket.id}/restore`, () =>
      HttpResponse.json(
        {
          error_code: 'NAME_ALREADY_EXISTS',
          message: 'Name already exists',
        } satisfies components['schemas']['ErrorResponse'],
        { status: 409 },
      ),
    ),
  );
  render(<Component />, { initialEntries: ['/locations'] });
  const list = await screen.findByRole('region', { name: 'Locations' });

  // act
  await user.click(await within(list).findByRole('button', { name: 'Restore' }));

  // assert
  const restoreForm = await screen.findByRole('form', { name: 'Restore location' });
  const name = within(restoreForm).getByRole('textbox', { name: 'Name' });
  expect(name).toHaveValue('Old market');
  expect(name).toHaveAccessibleDescription('An active location already has this name');
  expect(screen.queryByText('Something went wrong. Please try again.')).not.toBeInTheDocument();
});

test('shows the error notification when a restore fails for another reason', async () => {
  // arrange
  const user = userEvent.setup();
  server.use(
    http.get('http://localhost/api/accounting/locations', () =>
      HttpResponse.json(readLocationPage([oldMarket])),
    ),
    http.post(`http://localhost/api/accounting/locations/${oldMarket.id}/restore`, () =>
      HttpResponse.json(
        {
          error_code: 'ENTITY_NOT_FOUND',
          message: 'Location not found',
        } satisfies components['schemas']['ErrorResponse'],
        { status: 404 },
      ),
    ),
  );
  render(<Component />, { initialEntries: ['/locations'] });
  const list = await screen.findByRole('region', { name: 'Locations' });

  // act
  await user.click(await within(list).findByRole('button', { name: 'Restore' }));

  // assert
  expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
  expect(screen.queryByRole('form', { name: 'Restore location' })).not.toBeInTheDocument();
});

test('shows the transactions of the chosen location beside the list', async () => {
  // arrange
  const requestedLocationIds: string[] = [];
  server.use(
    http.get('http://localhost/api/accounting/locations', () =>
      HttpResponse.json(readLocationPage([spar, coffeeLab])),
    ),
    http.get('http://localhost/api/accounting/transactions', ({ request }) => {
      requestedLocationIds.push(new URL(request.url).searchParams.getAll('location_ids').join());
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
  render(<Component />, { initialEntries: [`/locations?location=${coffeeLab.id}`] });

  // assert
  const transactions = await screen.findByRole('region', { name: 'Transactions of Coffee Lab' });
  expect(within(transactions).getByText('Location · recent transactions')).toBeInTheDocument();
  expect(within(transactions).getByRole('link', { name: 'All' })).toHaveAttribute(
    'href',
    `/transactions?location_ids=${coffeeLab.id}`,
  );
  expect(
    await within(transactions).findByText('No transactions at this location yet'),
  ).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Coffee Lab' })).toHaveAttribute('aria-current', 'true');
  expect(requestedLocationIds).toEqual([coffeeLab.id]);
});

test('gives a phone plain names and no transactions of a location', async () => {
  // arrange
  vi.stubGlobal('innerWidth', 390);
  let transactionRequestCount = 0;
  server.use(
    http.get('http://localhost/api/accounting/locations', () =>
      HttpResponse.json(readLocationPage([spar, coffeeLab])),
    ),
    http.get('http://localhost/api/accounting/transactions', () => {
      transactionRequestCount += 1;
      return HttpResponse.json(null, { status: 400 });
    }),
  );

  // act
  render(<Component />, { initialEntries: [`/locations?location=${coffeeLab.id}`] });

  // assert
  const list = await screen.findByRole('region', { name: 'Locations' });
  expect(await within(list).findByText('Spar')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Coffee Lab' })).not.toBeInTheDocument();
  expect(screen.queryByRole('region', { name: /^Transactions of/ })).not.toBeInTheDocument();
  expect(transactionRequestCount).toBe(0);
});

test('shows an empty state instead of the list when there are no locations', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/accounting/locations', () =>
      HttpResponse.json(readLocationPage([])),
    ),
  );

  // act
  render(<Component />, { initialEntries: ['/locations'] });

  // assert
  expect(await screen.findByText('No locations yet')).toBeInTheDocument();
  expect(screen.getByText('Add the places you pay at, like a shop or a café.')).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Locations' })).not.toBeInTheDocument();
});
