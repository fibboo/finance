import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, expect, test, vi } from 'vitest';

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
  base_currency_rate: '0',
  status: 'ACTIVE',
  base_currency_balance: '0',
} satisfies components['schemas']['Account'];

const coffee = {
  ...groceries,
  name: 'Coffee shops',
  id: '8c1a3c2b-1a04-4b9e-9d1f-0e6a7f0c2f4f',
} satisfies components['schemas']['Account'];

const categoryPurposes = [
  { key: 'PERSONAL', label: 'Personal' },
  { key: 'INCOME_COST', label: 'Income costs' },
];

const variableType = {
  id: '10000000-0000-4000-8000-000000000011',
  name: 'Variable',
  kind: 'EXPENSE_CATEGORY',
  is_default: true,
};
const fixedType = {
  id: '10000000-0000-4000-8000-000000000012',
  name: 'Fixed',
  kind: 'EXPENSE_CATEGORY',
  is_default: false,
};
const periodicType = {
  id: '10000000-0000-4000-8000-000000000013',
  name: 'Periodic',
  kind: 'EXPENSE_CATEGORY',
  is_default: false,
};

beforeEach(() => {
  server.use(
    http.get('http://localhost/api/accounting/classifications/EXPENSE_CATEGORY', () =>
      HttpResponse.json([variableType, fixedType, periodicType]),
    ),
  );
});

test.each([variableType, fixedType, periodicType])(
  'creates a category with its $name type',
  async ({ id }) => {
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
        categoryPurposes={categoryPurposes}
        onBack={vi.fn()}
      />,
    );
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Type' }), id);
    await vi.waitFor(() => {
      expect(screen.getByRole('button', { name: 'Create category' })).toBeEnabled();
    });

    // act
    await user.click(screen.getByRole('button', { name: 'Create category' }));

    // assert
    await vi.waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith(coffee.id);
    });
    expect(createdCategory).toEqual({
      name: 'Coffee shops',
      description: null,
      kind: 'EXPENSE',
      classification_id: id,
      category_purpose: 'PERSONAL',
    });
  },
);

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
      categoryPurposes={categoryPurposes}
      onBack={vi.fn()}
    />,
  );
  const name = screen.getByRole('textbox', { name: 'Name' });
  const description = screen.getByRole('textbox', { name: /Description/ });
  expect(screen.getByRole('form', { name: 'Edit category' })).toBeInTheDocument();
  expect(name).toHaveValue('Groceries');
  expect(description).toHaveValue('Supermarkets');
  expect(await screen.findByRole('combobox', { name: 'Type' })).toHaveValue(variableType.id);
  await user.clear(name);
  await user.type(name, 'Food');
  await user.selectOptions(screen.getByRole('combobox', { name: 'Type' }), periodicType.id);
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
    classification_id: periodicType.id,
    category_purpose: 'PERSONAL',
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
      categoryPurposes={categoryPurposes}
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
      const items = lookupQuery.get('search_term') === 'groceries' ? [groceries] : [];
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
      categoryPurposes={categoryPurposes}
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
      categoryPurposes={categoryPurposes}
      onBack={vi.fn()}
    />,
  );

  // assert
  await vi.waitFor(() => {
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  });
  expect(screen.getByRole('textbox', { name: 'Name' })).not.toHaveAccessibleDescription();
});

test('warns only while the edited category purpose differs from the saved purpose', async () => {
  // arrange
  const user = userEvent.setup();
  render(
    <CategoryForm
      mode={{
        kind: 'edit',
        category: { ...groceries, category_purpose: 'INCOME_COST' },
        relatedQueryKeys: [],
        onSaved: vi.fn(),
      }}
      categoryPurposes={categoryPurposes}
      onBack={vi.fn()}
    />,
  );
  expect(screen.getByRole('radio', { name: 'Income costs' })).toBeChecked();
  expect(screen.queryByText(/Applies to all past transactions/)).not.toBeInTheDocument();

  // act
  await user.click(screen.getByRole('radio', { name: 'Personal' }));

  // assert
  expect(screen.getByText(/Applies to all past transactions/)).toBeInTheDocument();
  await user.click(screen.getByRole('radio', { name: 'Income costs' }));
  expect(screen.queryByText(/Applies to all past transactions/)).not.toBeInTheDocument();
});
