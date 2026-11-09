import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, expect, test } from 'vitest';

import { NewTransaction } from '@/app/new-transaction';
import type { components } from '@/lib/api-schema';
import { render } from '@/test/render';
import { server } from '@/test/setup';

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
  id: '3c2b1a04-8c1a-4b9e-9d1f-0e6a7f0c2f4e',
  kind: 'EXPENSE',
  currency: null,
  category_type: 'VARIABLE',
} satisfies components['schemas']['Account'];

const salary = {
  ...groceries,
  name: 'Salary',
  id: '4a52f0e1-1d7b-4a52-9f3a-0b5c1f0e8d44',
  kind: 'INCOME',
  category_type: null,
} satisfies components['schemas']['Account'];

const market = {
  name: 'Central market',
  description: null,
  user_id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
  id: '9e0f1a2b-2b4f-4e6a-8c7d-5a1d9c3e3c40',
  status: 'ACTIVE',
  created_at: '2026-10-01T09:00:00Z',
  updated_at: '2026-10-01T09:00:00Z',
} satisfies components['schemas']['Location'];

const carrefour = {
  ...market,
  name: 'Carrefour',
  description: 'Supermarket next to home',
  id: '2b4f9e0f-1a2b-4e6a-8c7d-5a1d9c3e3c41',
} satisfies components['schemas']['Location'];

const freelance = {
  ...salary,
  name: 'Freelance',
  id: '1d7b4a52-f0e1-4a52-9f3a-0b5c1f0e8d45',
  color: '#2E8C7A',
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
        currencies: [],
        account_kinds: [],
        category_types: [],
        transaction_types: [{ key: 'ADJUSTMENT', label: 'Adjustment' }],
        transaction_orders: [],
      } satisfies components['schemas']['AccountingDictionaries']),
    ),
    http.get('http://localhost/api/accounting/accounts', ({ request }) => {
      const kinds = new URL(request.url).searchParams.getAll('kinds');
      const items = kinds.includes('ASSET') && kinds.includes('LIABILITY') ? [wallet] : [];
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

test('lists the money accounts in the account picker', async () => {
  // arrange
  const user = userEvent.setup();
  render(<NewTransaction />, { initialEntries: ['/?new_transaction=ADJUSTMENT'] });

  // act
  await user.click(await screen.findByRole('button', { name: /^Account/ }));

  // assert
  expect(await screen.findByRole('button', { name: /^Wallet/ })).toBeInTheDocument();
});

test.each(['{Escape}', 'close button'])('closes the form with the %s', async (closeWith) => {
  // arrange
  const user = userEvent.setup();
  render(<NewTransaction />, { initialEntries: ['/?new_transaction=ADJUSTMENT'] });
  const closeButton = await screen.findByRole('button', { name: 'Close' });

  // act
  if (closeWith === 'close button') {
    await user.click(closeButton);
  } else {
    await user.keyboard(closeWith);
  }

  // assert
  expect(screen.queryByRole('dialog', { name: 'New transaction' })).not.toBeInTheDocument();
});

test('opens an adjustment with the account of the new transaction account param chosen', async () => {
  // act
  render(<NewTransaction />, {
    initialEntries: [`/?new_transaction=ADJUSTMENT&new_transaction_account=${wallet.id}`],
  });

  // assert
  expect(await screen.findByRole('button', { name: /^Account/ })).toHaveTextContent('Wallet');
});

test('drops the preset account once the type of the new transaction changes', async () => {
  // arrange
  const user = userEvent.setup();
  server.use(
    http.get('http://localhost/api/dictionaries/accounting', () =>
      HttpResponse.json({
        currencies: [],
        account_kinds: [],
        category_types: [],
        transaction_types: [
          { key: 'EXPENSE', label: 'Expense' },
          { key: 'ADJUSTMENT', label: 'Adjustment' },
        ],
        transaction_orders: [],
      } satisfies components['schemas']['AccountingDictionaries']),
    ),
    http.get('http://localhost/api/accounting/locations', () =>
      HttpResponse.json({
        items: [],
        total: 0,
        page: 1,
        size: 100,
        pages: 0,
      } satisfies components['schemas']['Page_Location_']),
    ),
  );
  render(<NewTransaction />, {
    initialEntries: [`/?new_transaction=ADJUSTMENT&new_transaction_account=${wallet.id}`],
  });
  await screen.findByRole('button', { name: /^Account/ });
  await user.click(screen.getByRole('radio', { name: 'Expense' }));

  // act
  await user.click(await screen.findByRole('radio', { name: 'Adjustment' }));

  // assert
  expect(await screen.findByRole('button', { name: /^Account/ })).not.toHaveTextContent('Wallet');
});

test('stays closed without the new transaction param', () => {
  // act
  render(<NewTransaction />, { initialEntries: ['/?new_transaction=LOAN'] });

  // assert
  expect(screen.queryByRole('dialog', { name: 'New transaction' })).not.toBeInTheDocument();
});

test('leaves the account picker for the form with Escape', async () => {
  // arrange
  const user = userEvent.setup();
  render(<NewTransaction />, { initialEntries: ['/?new_transaction=ADJUSTMENT'] });
  await user.click(await screen.findByRole('button', { name: /^Account/ }));
  await screen.findByRole('searchbox', { name: 'Search accounts' });

  // act
  await user.keyboard('{Escape}');

  // assert
  expect(screen.getByRole('button', { name: 'Adjust balance' })).toBeVisible();
});

test('lists the money accounts used most recently first', async () => {
  // arrange
  let requestedOrder: string | null = null;
  server.use(
    http.get('http://localhost/api/accounting/accounts', ({ request }) => {
      requestedOrder = new URL(request.url).searchParams.get('order');
      return HttpResponse.json({
        items: [wallet],
        total: 1,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']);
    }),
  );
  const user = userEvent.setup();
  render(<NewTransaction />, { initialEntries: ['/?new_transaction=ADJUSTMENT'] });

  // act
  await user.click(await screen.findByRole('button', { name: /^Account/ }));

  // assert
  await screen.findByRole('button', { name: /^Wallet/ });
  expect(requestedOrder).toBe('recent_use');
});

test('lists the categories and the locations used most recently first', async () => {
  // arrange
  let requestedCategoryOrder: string | null = null;
  let requestedLocationOrder: string | null = null;
  server.use(
    http.get('http://localhost/api/accounting/accounts', ({ request }) => {
      const searchParams = new URL(request.url).searchParams;
      const items = searchParams.getAll('kinds').includes('EXPENSE') ? [groceries] : [wallet];
      if (searchParams.getAll('kinds').includes('EXPENSE')) {
        requestedCategoryOrder = searchParams.get('order');
      }
      return HttpResponse.json({
        items,
        total: items.length,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']);
    }),
    http.get('http://localhost/api/accounting/locations', ({ request }) => {
      requestedLocationOrder = new URL(request.url).searchParams.get('order');
      return HttpResponse.json({
        items: [
          {
            name: 'Central market',
            description: null,
            user_id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
            id: '9e0f1a2b-2b4f-4e6a-8c7d-5a1d9c3e3c40',
            status: 'ACTIVE',
            created_at: '2026-10-01T09:00:00Z',
            updated_at: '2026-10-01T09:00:00Z',
          },
        ],
        total: 1,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Location_']);
    }),
  );
  const user = userEvent.setup();
  render(<NewTransaction />, { initialEntries: ['/?new_transaction=EXPENSE'] });
  await user.click(await screen.findByRole('button', { name: /^Category/ }));
  await screen.findByRole('button', { name: /^Groceries/ });
  await user.click(screen.getByRole('button', { name: 'Back' }));

  // act
  await user.click(screen.getByRole('button', { name: /^Location/ }));

  // assert
  expect(await screen.findByRole('button', { name: /^Central market/ })).toBeInTheDocument();
  expect([requestedCategoryOrder, requestedLocationOrder]).toEqual(['recent_use', 'recent_use']);
});

test('lists the income sources used most recently first', async () => {
  // arrange
  let requestedOrder: string | null = null;
  server.use(
    http.get('http://localhost/api/accounting/accounts', ({ request }) => {
      const searchParams = new URL(request.url).searchParams;
      const isIncomeSourceList = searchParams.getAll('kinds').includes('INCOME');
      const items = isIncomeSourceList ? [salary] : [wallet];
      if (isIncomeSourceList) {
        requestedOrder = searchParams.get('order');
      }
      return HttpResponse.json({
        items,
        total: items.length,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']);
    }),
  );
  const user = userEvent.setup();
  render(<NewTransaction />, { initialEntries: ['/?new_transaction=INCOME'] });

  // act
  await user.click(await screen.findByRole('button', { name: /^Source/ }));

  // assert
  expect(await screen.findByRole('button', { name: /^Salary/ })).toBeInTheDocument();
  expect(requestedOrder).toBe('recent_use');
});

test.each([
  { search: 'Central', isCreateOffered: true },
  { search: ' central market ', isCreateOffered: false },
])(
  'offers to create “$search” only when no location has that name',
  async ({ search, isCreateOffered }) => {
    // arrange
    server.use(
      http.get('http://localhost/api/accounting/locations', () =>
        HttpResponse.json({
          items: [market],
          total: 1,
          page: 1,
          size: 100,
          pages: 1,
        } satisfies components['schemas']['Page_Location_']),
      ),
    );
    const user = userEvent.setup();
    render(<NewTransaction />, { initialEntries: ['/?new_transaction=EXPENSE'] });
    await user.click(await screen.findByRole('button', { name: /^Location/ }));
    await screen.findByRole('button', { name: /^Central market/ });

    // act
    await user.type(screen.getByRole('searchbox', { name: 'Search locations' }), search);

    // assert
    expect(screen.queryByRole('button', { name: /^Create/ }) !== null).toBe(isCreateOffered);
  },
);

test.each([
  { transactionType: 'EXPENSE', picker: /^From/, create: 'Create account', form: 'New account' },
  {
    transactionType: 'EXPENSE',
    picker: /^Category/,
    create: 'Create category',
    form: 'New category',
  },
  { transactionType: 'INCOME', picker: /^To/, create: 'Create account', form: 'New account' },
  { transactionType: 'TRANSFER', picker: /^From/, create: 'Create account', form: 'New account' },
  { transactionType: 'TRANSFER', picker: /^To/, create: 'Create account', form: 'New account' },
  {
    transactionType: 'ADJUSTMENT',
    picker: /^Account/,
    create: 'Create account',
    form: 'New account',
  },
])(
  'opens $form from the $picker picker of $transactionType',
  async ({ transactionType, picker, create, form }) => {
    // arrange
    server.use(
      http.get('http://localhost/api/accounting/locations', () =>
        HttpResponse.json({
          items: [],
          total: 0,
          page: 1,
          size: 100,
          pages: 1,
        } satisfies components['schemas']['Page_Location_']),
      ),
    );
    const user = userEvent.setup();
    render(<NewTransaction />, { initialEntries: [`/?new_transaction=${transactionType}`] });
    await user.click(await screen.findByRole('button', { name: picker }));

    // act
    await user.click(await screen.findByRole('button', { name: create }));

    // assert
    expect(screen.getByRole('form', { name: form })).toBeInTheDocument();
  },
);

test('lists Create location first before any search', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/accounting/locations', () =>
      HttpResponse.json({
        items: [market],
        total: 1,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Location_']),
    ),
  );
  const user = userEvent.setup();
  render(<NewTransaction />, { initialEntries: ['/?new_transaction=EXPENSE'] });

  // act
  await user.click(await screen.findByRole('button', { name: /^Location/ }));

  // assert
  const locationList = await screen.findByRole('list', { name: 'Location' });
  expect(
    within(locationList)
      .getAllByRole('button')
      .map((button) => button.textContent),
  ).toEqual(['Create location', 'Central market']);
});

test('creates a location from its picker and selects it', async () => {
  // arrange
  let locations: components['schemas']['Location'][] = [market];
  let createdLocation: unknown = null;
  server.use(
    http.get('http://localhost/api/accounting/locations', () =>
      HttpResponse.json({
        items: locations,
        total: locations.length,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Location_']),
    ),
    http.post('http://localhost/api/accounting/locations', async ({ request }) => {
      createdLocation = await request.json();
      locations = [market, carrefour];
      return HttpResponse.json(carrefour satisfies components['schemas']['Location'], {
        status: 201,
      });
    }),
  );
  const user = userEvent.setup();
  render(<NewTransaction />, { initialEntries: ['/?new_transaction=EXPENSE'] });
  await user.click(await screen.findByRole('button', { name: /^Location/ }));
  await screen.findByRole('button', { name: /^Central market/ });
  await user.type(screen.getByRole('searchbox', { name: 'Search locations' }), ' Carrefour ');
  await user.click(screen.getByRole('button', { name: 'Create “Carrefour”' }));
  await user.type(
    screen.getByRole('textbox', { name: /^Description/ }),
    'Supermarket next to home',
  );

  // act
  await user.click(screen.getByRole('button', { name: 'Create location' }));

  // assert
  expect(await screen.findByRole('button', { name: /^Location.*Carrefour/ })).toBeVisible();
  expect(createdLocation).toEqual({ name: 'Carrefour', description: 'Supermarket next to home' });
});

test('creates an income source from the Source picker and selects it', async () => {
  // arrange
  let incomeSources: components['schemas']['Account'][] = [salary];
  let createdAccount: unknown = null;
  server.use(
    http.get('http://localhost/api/accounting/accounts', ({ request }) => {
      const items = new URL(request.url).searchParams.getAll('kinds').includes('INCOME')
        ? incomeSources
        : [wallet];
      return HttpResponse.json({
        items,
        total: items.length,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']);
    }),
    http.post('http://localhost/api/accounting/accounts', async ({ request }) => {
      createdAccount = await request.json();
      incomeSources = [...incomeSources, freelance];
      return HttpResponse.json(freelance satisfies components['schemas']['Account'], {
        status: 201,
      });
    }),
  );
  const user = userEvent.setup();
  render(<NewTransaction />, { initialEntries: ['/?new_transaction=INCOME'] });
  await user.click(await screen.findByRole('button', { name: /^Source/ }));
  await screen.findByRole('button', { name: /^Salary/ });
  await user.type(screen.getByRole('searchbox', { name: 'Search income sources' }), 'Freelance');
  await user.click(screen.getByRole('button', { name: 'Create “Freelance”' }));

  // act
  await user.click(screen.getByRole('button', { name: 'Create income source' }));

  // assert
  expect(await screen.findByRole('button', { name: /^Source.*Freelance/ })).toBeVisible();
  expect(createdAccount).toEqual({
    name: 'Freelance',
    description: null,
    kind: 'INCOME',
  });
});

test.each(['{Escape}', 'back button'])(
  'returns from the create form to the picker with its search with the %s',
  async (backWith) => {
    // arrange
    server.use(
      http.get('http://localhost/api/accounting/locations', () =>
        HttpResponse.json({
          items: [market],
          total: 1,
          page: 1,
          size: 100,
          pages: 1,
        } satisfies components['schemas']['Page_Location_']),
      ),
    );
    const user = userEvent.setup();
    render(<NewTransaction />, { initialEntries: ['/?new_transaction=EXPENSE'] });
    await user.click(await screen.findByRole('button', { name: /^Location/ }));
    await screen.findByRole('button', { name: /^Central market/ });
    await user.type(screen.getByRole('searchbox', { name: 'Search locations' }), 'Carrefour');
    await user.click(screen.getByRole('button', { name: 'Create “Carrefour”' }));

    // act
    if (backWith === 'back button') {
      await user.click(screen.getByRole('button', { name: 'Back' }));
    } else {
      await user.keyboard(backWith);
    }

    // assert
    expect(screen.getByRole('searchbox', { name: 'Search locations' })).toHaveValue('Carrefour');
  },
);
