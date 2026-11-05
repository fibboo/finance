import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { expect, test, vi } from 'vitest';

import { ACCOUNT_COLORS } from '@/lib/account-colors';
import type { components } from '@/lib/api-schema';
import { render } from '@/test/render';
import { server } from '@/test/setup';

import { IncomeSourceForm } from './income-source-form';

const salary = {
  name: 'Salary',
  id: '4a52f0e1-1d7b-4a52-9f3a-0b5c1f0e8d44',
  user_id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
  kind: 'INCOME',
  balance: '0',
  currency: null,
  color: '#4D8FBF',
  category_type: null,
  base_currency_rate: '0',
  status: 'ACTIVE',
  base_currency_balance: '0',
} satisfies components['schemas']['Account'];

const freelance = {
  ...salary,
  name: 'Freelance',
  id: '1d7b4a52-f0e1-4a52-9f3a-0b5c1f0e8d45',
  color: '#2F9BB3',
} satisfies components['schemas']['Account'];

test('dims the colors other income sources use and sends the color picked', async () => {
  // arrange
  let createdAccount: unknown = null;
  const onCreated = vi.fn();
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items: [salary],
        total: 1,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']),
    ),
    http.post('http://localhost/api/accounting/accounts', async ({ request }) => {
      createdAccount = await request.json();
      return HttpResponse.json(freelance satisfies components['schemas']['Account'], {
        status: 201,
      });
    }),
  );
  const user = userEvent.setup();
  render(<IncomeSourceForm name="Freelance" onCreated={onCreated} onBack={vi.fn()} />);
  await screen.findByText('Dimmed colors are used by other income sources.');
  await user.click(screen.getByRole('radio', { name: 'Cyan' }));

  // act
  await user.click(screen.getByRole('button', { name: 'Create income source' }));

  // assert
  await vi.waitFor(() => {
    expect(onCreated).toHaveBeenCalledWith(freelance.id);
  });
  expect(screen.getByRole('radio', { name: 'Blue' })).toBeDisabled();
  expect(createdAccount).toEqual({
    name: 'Freelance',
    description: null,
    kind: 'INCOME',
    color: '#2F9BB3',
  });
});

test('disables creating while every color is used by another income source', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/accounting/accounts', () => {
      const items = ACCOUNT_COLORS.map((color, index) => ({
        ...salary,
        id: `4a52f0e1-1d7b-4a52-9f3a-0b5c1f0e8d${String(index).padStart(2, '0')}`,
        color: color.value,
      }));
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
  render(<IncomeSourceForm name="Freelance" onCreated={vi.fn()} onBack={vi.fn()} />);

  // assert
  expect(
    await screen.findByText(
      "Every color is used by other income sources, so a new one can't be created yet.",
    ),
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Create income source' })).toBeDisabled();
});

test('shows a taken name at the Name field', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items: [salary],
        total: 1,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']),
    ),
    http.post('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json(
        {
          message: 'Name already exists',
          error_code: 'NAME_ALREADY_EXISTS',
        } satisfies components['schemas']['ErrorResponse'],
        { status: 409 },
      ),
    ),
  );
  const user = userEvent.setup();
  render(<IncomeSourceForm name="Salary" onCreated={vi.fn()} onBack={vi.fn()} />);
  await screen.findByText('Dimmed colors are used by other income sources.');

  // act
  await user.click(screen.getByRole('button', { name: 'Create income source' }));

  // assert
  expect(await screen.findByRole('textbox', { name: 'Name' })).toHaveAccessibleDescription(
    'Name already exists',
  );
});
