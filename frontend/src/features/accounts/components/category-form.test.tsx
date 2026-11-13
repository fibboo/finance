import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { expect, test, vi } from 'vitest';

import type { components } from '@/lib/api-schema';
import { render } from '@/test/render';
import { server } from '@/test/setup';

import { CategoryForm } from './category-form';

const groceries = {
  name: 'Groceries',
  id: '3c2b1a04-8c1a-4b9e-9d1f-0e6a7f0c2f4e',
  user_id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
  kind: 'EXPENSE',
  balance: '0',
  currency: null,
  color: null,
  category_type: 'VARIABLE',
  base_currency_rate: '0',
  status: 'ACTIVE',
  base_currency_balance: '0',
} satisfies components['schemas']['Account'];

const coffee = {
  ...groceries,
  name: 'Coffee shops',
  id: '8c1a3c2b-1a04-4b9e-9d1f-0e6a7f0c2f4f',
} satisfies components['schemas']['Account'];

const categoryTypes = [
  { key: 'VARIABLE', label: 'Variable' },
  { key: 'FIXED', label: 'Fixed' },
  { key: 'PERIODIC', label: 'Periodic' },
];

test.each([
  {
    type: 'Variable',
    category_type: 'VARIABLE',
    hint: 'Spending that changes from month to month, like groceries or taxis.',
  },
  {
    type: 'Fixed',
    category_type: 'FIXED',
    hint: 'The same amount every month, like rent or subscriptions.',
  },
  {
    type: 'Periodic',
    category_type: 'PERIODIC',
    hint: 'Comes a few times a year, like insurance or gifts.',
  },
])('creates a $type category with the hint of its type', async ({ type, category_type, hint }) => {
  // arrange
  let createdCategory: unknown = null;
  const onCreated = vi.fn();
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
    http.post('http://localhost/api/accounting/accounts', async ({ request }) => {
      createdCategory = await request.json();
      return HttpResponse.json(coffee satisfies components['schemas']['Account'], {
        status: 201,
      });
    }),
  );
  const user = userEvent.setup();
  render(
    <CategoryForm
      mode={{ kind: 'create', name: 'Coffee shops', onCreated }}
      categoryTypes={categoryTypes}
      onBack={vi.fn()}
    />,
  );
  await user.click(screen.getByRole('radio', { name: type }));
  await vi.waitFor(() => {
    expect(screen.getByRole('button', { name: 'Create category' })).toBeEnabled();
  });

  // act
  await user.click(screen.getByRole('button', { name: 'Create category' }));

  // assert
  await vi.waitFor(() => {
    expect(onCreated).toHaveBeenCalledWith(coffee.id);
  });
  expect(screen.getByRole('group', { name: 'Type' })).toHaveAccessibleDescription(hint);
  expect(createdCategory).toEqual({
    name: 'Coffee shops',
    description: null,
    kind: 'EXPENSE',
    category_type,
  });
});

test('saves the changed name, type and description of an edited category', async () => {
  // arrange
  let updatedCategory: unknown = null;
  const onSaved = vi.fn();
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
    http.put(`http://localhost/api/accounting/accounts/${groceries.id}`, async ({ request }) => {
      updatedCategory = await request.json();
      return HttpResponse.json(groceries satisfies components['schemas']['Account']);
    }),
  );
  const user = userEvent.setup();
  render(
    <CategoryForm
      mode={{
        kind: 'edit',
        category: { ...groceries, description: 'Supermarkets' },
        relatedQueryKeys: [],
        onSaved,
      }}
      categoryTypes={categoryTypes}
      onBack={vi.fn()}
    />,
  );
  const name = screen.getByRole('textbox', { name: 'Name' });
  const description = screen.getByRole('textbox', { name: /Description/ });
  expect(screen.getByRole('form', { name: 'Edit category' })).toBeInTheDocument();
  expect(name).toHaveValue('Groceries');
  expect(description).toHaveValue('Supermarkets');
  expect(screen.getByRole('radio', { name: 'Variable' })).toBeChecked();
  await user.clear(name);
  await user.type(name, 'Food');
  await user.click(screen.getByRole('radio', { name: 'Periodic' }));
  await user.clear(description);
  await vi.waitFor(() => {
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  });

  // act
  await user.click(screen.getByRole('button', { name: 'Save changes' }));

  // assert
  await vi.waitFor(() => {
    expect(onSaved).toHaveBeenCalledOnce();
  });
  expect(updatedCategory).toEqual({
    name: 'Food',
    description: null,
    category_type: 'PERIODIC',
  });
});

test('shows a name another category has under the name field of the edit form', async () => {
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
    http.put(`http://localhost/api/accounting/accounts/${groceries.id}`, () =>
      HttpResponse.json(
        {
          error_code: 'NAME_ALREADY_EXISTS',
          message: 'This name is already taken',
        } satisfies components['schemas']['ErrorResponse'],
        { status: 409 },
      ),
    ),
  );
  const user = userEvent.setup();
  render(
    <CategoryForm
      mode={{ kind: 'edit', category: groceries, relatedQueryKeys: [], onSaved: vi.fn() }}
      categoryTypes={categoryTypes}
      onBack={vi.fn()}
    />,
  );
  await vi.waitFor(() => {
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  });

  // act
  await user.click(screen.getByRole('button', { name: 'Save changes' }));

  // assert
  expect(await screen.findByText('This name is already taken')).toBeInTheDocument();
});

test('says a name an active category holds while it is typed and keeps Create category disabled', async () => {
  // arrange
  let lookupQuery = new URLSearchParams();
  server.use(
    http.get('http://localhost/api/accounting/accounts', ({ request }) => {
      lookupQuery = new URL(request.url).searchParams;
      const items = lookupQuery.get('search_term') === 'Groceries' ? [groceries] : [];
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
  render(
    <CategoryForm
      mode={{ kind: 'create', name: '', onCreated: vi.fn() }}
      categoryTypes={categoryTypes}
      onBack={vi.fn()}
    />,
  );
  const name = screen.getByRole('textbox', { name: 'Name' });

  // act
  await user.type(name, 'Groceries');

  // assert
  await vi.waitFor(() => {
    expect(name).toHaveAccessibleDescription('An active category already has this name');
  });
  expect(screen.getByRole('button', { name: 'Create category' })).toBeDisabled();
  expect(lookupQuery.getAll('kinds')).toEqual(['EXPENSE']);
  expect(lookupQuery.getAll('statuses')).toEqual(['ACTIVE']);
  // a name that differs only by one letter is free
  await user.type(name, 's');
  await vi.waitFor(() => {
    expect(screen.getByRole('button', { name: 'Create category' })).toBeEnabled();
  });
  expect(name).not.toHaveAccessibleDescription();
});

test('leaves the edited category out of the names it finds taken', async () => {
  // arrange
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

  // act
  render(
    <CategoryForm
      mode={{ kind: 'edit', category: groceries, relatedQueryKeys: [], onSaved: vi.fn() }}
      categoryTypes={categoryTypes}
      onBack={vi.fn()}
    />,
  );

  // assert
  await vi.waitFor(() => {
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  });
  expect(screen.getByRole('textbox', { name: 'Name' })).not.toHaveAccessibleDescription();
});
