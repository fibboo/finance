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
      name="Coffee shops"
      categoryTypes={categoryTypes}
      onCreated={onCreated}
      onBack={vi.fn()}
    />,
  );
  await user.click(screen.getByRole('radio', { name: type }));

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
