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

test('opens with the name of the category and the reason an active category holds it', async () => {
  // arrange
  let lookupQuery = new URLSearchParams();
  server.use(
    http.get('http://localhost/api/accounting/accounts', ({ request }) => {
      lookupQuery = new URL(request.url).searchParams;
      return HttpResponse.json({
        items: [{ ...cigarettes, id: '5a6b4c7d-1c2d-3e4f-8e9f-0a1b2c3d4e61', status: 'ACTIVE' }],
        total: 1,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']);
    }),
  );

  // act
  render(
    <RestoreForm
      account={cigarettes}
      entityName="category"
      relatedQueryKeys={[]}
      onRestored={vi.fn()}
      onBack={vi.fn()}
    />,
  );

  // assert
  const name = screen.getByRole('textbox', { name: 'Name' });
  expect(name).toHaveValue('Cigarettes');
  await vi.waitFor(() => {
    expect(name).toHaveAccessibleDescription('An active category already has this name');
  });
  expect(screen.getByRole('button', { name: 'Restore category' })).toBeDisabled();
  expect(lookupQuery.getAll('kinds')).toEqual(['EXPENSE']);
  expect(lookupQuery.getAll('statuses')).toEqual(['ACTIVE']);
  expect(lookupQuery.get('search_term')).toBe('cigarettes');
});

test('names an income source in the window and in the reason an active one holds the name', async () => {
  // arrange
  const scholarship = {
    ...cigarettes,
    kind: 'INCOME',
    category_type: null,
    name: 'Scholarship',
  } satisfies components['schemas']['Account'];
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items: [{ ...scholarship, id: '5a6b4c7d-1c2d-3e4f-8e9f-0a1b2c3d4e61', status: 'ACTIVE' }],
        total: 1,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']),
    ),
  );

  // act
  render(
    <RestoreForm
      account={scholarship}
      entityName="income source"
      relatedQueryKeys={[]}
      onRestored={vi.fn()}
      onBack={vi.fn()}
    />,
  );

  // assert
  expect(screen.getByRole('form', { name: 'Restore income source' })).toBeInTheDocument();
  await vi.waitFor(() => {
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveAccessibleDescription(
      'An active income source already has this name',
    );
  });
});

test('drops the reason and allows the restore once a free name is typed', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/accounting/accounts', ({ request }) => {
      const searchTerm = new URL(request.url).searchParams.get('search_term');
      const items =
        searchTerm === 'cigarettes'
          ? [
              {
                ...cigarettes,
                id: '5a6b4c7d-1c2d-3e4f-8e9f-0a1b2c3d4e61',
                status: 'ACTIVE' as const,
              },
            ]
          : [];
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
    <RestoreForm
      account={cigarettes}
      entityName="category"
      relatedQueryKeys={[]}
      onRestored={vi.fn()}
      onBack={vi.fn()}
    />,
  );
  const name = screen.getByRole('textbox', { name: 'Name' });
  await vi.waitFor(() => {
    expect(name).toHaveAccessibleDescription('An active category already has this name');
  });

  // act
  await user.type(name, ' 2025');

  // assert
  await vi.waitFor(() => {
    expect(screen.getByRole('button', { name: 'Restore category' })).toBeEnabled();
  });
  expect(name).not.toHaveAccessibleDescription();
});

test('says a name an active category has in another case is taken', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items: [
          {
            ...cigarettes,
            name: 'cigarettes',
            id: '5a6b4c7d-1c2d-3e4f-8e9f-0a1b2c3d4e61',
            status: 'ACTIVE',
          },
        ],
        total: 1,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']),
    ),
  );

  // act
  render(
    <RestoreForm
      account={cigarettes}
      entityName="category"
      relatedQueryKeys={[]}
      onRestored={vi.fn()}
      onBack={vi.fn()}
    />,
  );

  // assert
  await vi.waitFor(() => {
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveAccessibleDescription(
      'An active category already has this name',
    );
  });
  expect(screen.getByRole('button', { name: 'Restore category' })).toBeDisabled();
});

test('restores the category under the typed name', async () => {
  // arrange
  let restoreBody: unknown = null;
  const onRestored = vi.fn();
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
      account={cigarettes}
      entityName="category"
      relatedQueryKeys={[]}
      onRestored={onRestored}
      onBack={vi.fn()}
    />,
  );
  const name = screen.getByRole('textbox', { name: 'Name' });
  await user.clear(name);
  await user.type(name, '  Cigarettes 2025 ');
  await vi.waitFor(() => {
    expect(screen.getByRole('button', { name: 'Restore category' })).toBeEnabled();
  });

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
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items: [],
        total: 0,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']),
    ),
    http.post(`http://localhost/api/accounting/accounts/${cigarettes.id}/restore`, () =>
      HttpResponse.json(NAME_TAKEN_RESPONSE, { status: 409 }),
    ),
  );
  const user = userEvent.setup();
  render(
    <RestoreForm
      account={cigarettes}
      entityName="category"
      relatedQueryKeys={[]}
      onRestored={onRestored}
      onBack={vi.fn()}
    />,
  );
  const name = screen.getByRole('textbox', { name: 'Name' });
  await user.clear(name);
  await user.type(name, 'Groceries');
  await vi.waitFor(() => {
    expect(screen.getByRole('button', { name: 'Restore category' })).toBeEnabled();
  });

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

test('shows the message of the backend under the name when it refuses the name for another reason', async () => {
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
    http.post(`http://localhost/api/accounting/accounts/${cigarettes.id}/restore`, () =>
      HttpResponse.json(
        {
          detail: [
            {
              loc: ['body', 'name'],
              msg: 'Value error, name is not allowed',
              type: 'value_error',
            },
          ],
        },
        { status: 422 },
      ),
    ),
  );
  const user = userEvent.setup();
  render(
    <RestoreForm
      account={cigarettes}
      entityName="category"
      relatedQueryKeys={[]}
      onRestored={vi.fn()}
      onBack={vi.fn()}
    />,
  );
  const name = screen.getByRole('textbox', { name: 'Name' });
  await user.clear(name);
  await user.type(name, 'Smokes');
  await vi.waitFor(() => {
    expect(screen.getByRole('button', { name: 'Restore category' })).toBeEnabled();
  });

  // act
  await user.click(screen.getByRole('button', { name: 'Restore category' }));

  // assert
  await vi.waitFor(() => {
    expect(name).toHaveAccessibleDescription('Value error, name is not allowed');
  });
});

test('shows the rule of the name instead of posting a name that is too short', async () => {
  // arrange
  const onRestored = vi.fn();
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
  );
  const user = userEvent.setup();
  render(
    <RestoreForm
      account={cigarettes}
      entityName="category"
      relatedQueryKeys={[]}
      onRestored={onRestored}
      onBack={vi.fn()}
    />,
  );
  const name = screen.getByRole('textbox', { name: 'Name' });
  await user.clear(name);
  await user.type(name, 'Ci');
  await vi.waitFor(() => {
    expect(screen.getByRole('button', { name: 'Restore category' })).toBeEnabled();
  });

  // act
  await user.click(screen.getByRole('button', { name: 'Restore category' }));

  // assert
  expect(await screen.findByText('Write at least 3 characters')).toBeInTheDocument();
  expect(onRestored).not.toHaveBeenCalled();
});
