import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { expect, test, vi } from 'vitest';

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
  color: null,
  category_type: null,
  base_currency_rate: '0',
  status: 'ACTIVE',
  base_currency_balance: '0',
} satisfies components['schemas']['Account'];

const freelance = {
  ...salary,
  name: 'Freelance',
  id: '1d7b4a52-f0e1-4a52-9f3a-0b5c1f0e8d45',
} satisfies components['schemas']['Account'];

test('creates an income source without a color', async () => {
  // arrange
  let createdAccount: unknown = null;
  const onCreated = vi.fn();
  server.use(
    http.post('http://localhost/api/accounting/accounts', async ({ request }) => {
      createdAccount = await request.json();
      return HttpResponse.json(freelance satisfies components['schemas']['Account'], {
        status: 201,
      });
    }),
  );
  const user = userEvent.setup();
  render(<IncomeSourceForm name="Freelance" onCreated={onCreated} onBack={vi.fn()} />);

  // act
  await user.click(screen.getByRole('button', { name: 'Create income source' }));

  // assert
  await vi.waitFor(() => {
    expect(onCreated).toHaveBeenCalledWith(freelance.id);
  });
  expect(screen.queryByRole('group', { name: 'Color' })).not.toBeInTheDocument();
  expect(createdAccount).toEqual({
    name: 'Freelance',
    description: null,
    kind: 'INCOME',
  });
});

test.each([
  { length: 32, createdCount: 1, error: '' },
  { length: 33, createdCount: 0, error: 'Write at most 32 characters' },
])(
  'creates the income source only with a name of 32 characters or fewer: $length',
  async ({ length, createdCount, error }) => {
    // arrange
    let requestCount = 0;
    server.use(
      http.post('http://localhost/api/accounting/accounts', () => {
        requestCount += 1;
        return HttpResponse.json(freelance satisfies components['schemas']['Account'], {
          status: 201,
        });
      }),
    );
    const onCreated = vi.fn();
    const user = userEvent.setup();
    render(<IncomeSourceForm name={'a'.repeat(length)} onCreated={onCreated} onBack={vi.fn()} />);

    // act
    await user.click(screen.getByRole('button', { name: 'Create income source' }));

    // assert
    await vi.waitFor(() => {
      expect(onCreated).toHaveBeenCalledTimes(createdCount);
      expect(screen.getByRole('textbox', { name: 'Name' })).toHaveAccessibleDescription(error);
    });
    expect(requestCount).toBe(createdCount);
  },
);

test('shows a taken name at the Name field', async () => {
  // arrange
  server.use(
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

  // act
  await user.click(screen.getByRole('button', { name: 'Create income source' }));

  // assert
  expect(await screen.findByRole('textbox', { name: 'Name' })).toHaveAccessibleDescription(
    'Name already exists',
  );
});
