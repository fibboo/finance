import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { expect, test, vi } from 'vitest';

import type { components } from '@/lib/api-schema';
import { render } from '@/test/render';
import { server } from '@/test/setup';

import { RestoreForm } from './restore-form';

const cigarettes = {
  name: 'Cigarettes',
  description: 'Quit in March',
  id: '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e60',
  user_id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
  kind: 'EXPENSE',
  balance: '0',
  currency: null,
  color: null,
  category_type: 'VARIABLE',
  base_currency_rate: '1',
  status: 'DELETED',
  base_currency_balance: '0',
} satisfies components['schemas']['Account'];

const NAME_TAKEN_RESPONSE = {
  error_code: 'NAME_ALREADY_EXISTS',
  message: 'Name already exists',
} satisfies components['schemas']['ErrorResponse'];

test('opens with the name of the category and the reason it was refused', () => {
  // act
  render(
    <RestoreForm
      category={cigarettes}
      relatedQueryKeys={[]}
      onRestored={vi.fn()}
      onBack={vi.fn()}
    />,
  );

  // assert
  const name = screen.getByRole('textbox', { name: 'Name' });
  expect(name).toHaveValue('Cigarettes');
  expect(name).toHaveAccessibleDescription('An active category already has this name');
});

test('restores the category under the typed name', async () => {
  // arrange
  let restoreBody: unknown = null;
  const onRestored = vi.fn();
  server.use(
    http.post(
      `http://localhost/api/accounting/accounts/${cigarettes.id}/restore`,
      async ({ request }) => {
        restoreBody = await request.json();
        return HttpResponse.json({
          ...cigarettes,
          name: 'Cigarettes 2025',
          status: 'ACTIVE',
        } satisfies components['schemas']['Account']);
      },
    ),
  );
  const user = userEvent.setup();
  render(
    <RestoreForm
      category={cigarettes}
      relatedQueryKeys={[]}
      onRestored={onRestored}
      onBack={vi.fn()}
    />,
  );
  const name = screen.getByRole('textbox', { name: 'Name' });
  await user.clear(name);
  await user.type(name, '  Cigarettes 2025 ');

  // act
  await user.click(screen.getByRole('button', { name: 'Restore category' }));

  // assert
  await vi.waitFor(() => {
    expect(onRestored).toHaveBeenCalledOnce();
  });
  expect(restoreBody).toEqual({ name: 'Cigarettes 2025' });
});

test('keeps the window open with the reason under the name when the new name is taken too', async () => {
  // arrange
  const onRestored = vi.fn();
  server.use(
    http.post(`http://localhost/api/accounting/accounts/${cigarettes.id}/restore`, () =>
      HttpResponse.json(NAME_TAKEN_RESPONSE, { status: 409 }),
    ),
  );
  const user = userEvent.setup();
  render(
    <RestoreForm
      category={cigarettes}
      relatedQueryKeys={[]}
      onRestored={onRestored}
      onBack={vi.fn()}
    />,
  );
  const name = screen.getByRole('textbox', { name: 'Name' });
  await user.clear(name);
  await user.type(name, 'Groceries');

  // act
  await user.click(screen.getByRole('button', { name: 'Restore category' }));

  // assert
  await vi.waitFor(() => {
    expect(name).toHaveAccessibleDescription('An active category already has this name');
  });
  expect(screen.getByRole('button', { name: 'Restore category' })).toBeEnabled();
  expect(onRestored).not.toHaveBeenCalled();
  expect(screen.queryByText('Something went wrong. Please try again.')).not.toBeInTheDocument();
});

test('shows the rule of the name instead of posting a name that is too short', async () => {
  // arrange
  const onRestored = vi.fn();
  const user = userEvent.setup();
  render(
    <RestoreForm
      category={cigarettes}
      relatedQueryKeys={[]}
      onRestored={onRestored}
      onBack={vi.fn()}
    />,
  );
  const name = screen.getByRole('textbox', { name: 'Name' });
  await user.clear(name);
  await user.type(name, 'Ci');

  // act
  await user.click(screen.getByRole('button', { name: 'Restore category' }));

  // assert
  expect(await screen.findByText('Write at least 3 characters')).toBeInTheDocument();
  expect(onRestored).not.toHaveBeenCalled();
});
