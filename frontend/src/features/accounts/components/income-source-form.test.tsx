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
      createdAccount = await request.json();
      return HttpResponse.json(freelance satisfies components['schemas']['Account'], {
        status: 201,
      });
    }),
  );
  const user = userEvent.setup();
  render(
    <IncomeSourceForm mode={{ kind: 'create', name: 'Freelance', onCreated }} onBack={vi.fn()} />,
  );
  await vi.waitFor(() => {
    expect(screen.getByRole('button', { name: 'Create income source' })).toBeEnabled();
  });

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
      http.get('http://localhost/api/accounting/accounts', () =>
        HttpResponse.json({
          items: [],
          total: 0,
          page: 1,
          size: 100,
          pages: 1,
        } satisfies components['schemas']['Page_Account_']),
      ),
      http.post('http://localhost/api/accounting/accounts', () => {
        requestCount += 1;
        return HttpResponse.json(freelance satisfies components['schemas']['Account'], {
          status: 201,
        });
      }),
    );
    const onCreated = vi.fn();
    const user = userEvent.setup();
    render(
      <IncomeSourceForm
        mode={{ kind: 'create', name: 'a'.repeat(length), onCreated }}
        onBack={vi.fn()}
      />,
    );
    await vi.waitFor(() => {
      expect(screen.getByRole('button', { name: 'Create income source' })).toBeEnabled();
    });

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
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items: [],
        total: 0,
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
  render(
    <IncomeSourceForm
      mode={{ kind: 'create', name: 'Salary', onCreated: vi.fn() }}
      onBack={vi.fn()}
    />,
  );
  await vi.waitFor(() => {
    expect(screen.getByRole('button', { name: 'Create income source' })).toBeEnabled();
  });

  // act
  await user.click(screen.getByRole('button', { name: 'Create income source' }));

  // assert
  expect(await screen.findByRole('textbox', { name: 'Name' })).toHaveAccessibleDescription(
    'Name already exists',
  );
});

test('saves the changed name and description of an edited income source', async () => {
  // arrange
  let updatedIncomeSource: unknown = null;
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
    http.put(`http://localhost/api/accounting/accounts/${salary.id}`, async ({ request }) => {
      updatedIncomeSource = await request.json();
      return HttpResponse.json(salary satisfies components['schemas']['Account']);
    }),
  );
  const user = userEvent.setup();
  render(
    <IncomeSourceForm
      mode={{
        kind: 'edit',
        incomeSource: { ...salary, description: 'Main job' },
        relatedQueryKeys: [],
        onSaved,
      }}
      onBack={vi.fn()}
    />,
  );
  const name = screen.getByRole('textbox', { name: 'Name' });
  const description = screen.getByRole('textbox', { name: /Description/ });
  expect(screen.getByRole('form', { name: 'Edit income source' })).toBeInTheDocument();
  expect(name).toHaveValue('Salary');
  expect(description).toHaveValue('Main job');
  await user.clear(name);
  await user.type(name, 'Wages');
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
  expect(updatedIncomeSource).toEqual({ name: 'Wages', description: null });
});

test('shows a name another income source has under the name field of the edit form', async () => {
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
    http.put(`http://localhost/api/accounting/accounts/${salary.id}`, () =>
      HttpResponse.json(
        {
          message: 'Name already exists',
          error_code: 'NAME_ALREADY_EXISTS',
        } satisfies components['schemas']['ErrorResponse'],
        { status: 409 },
      ),
    ),
  );
  const onSaved = vi.fn();
  const user = userEvent.setup();
  render(
    <IncomeSourceForm
      mode={{ kind: 'edit', incomeSource: salary, relatedQueryKeys: [], onSaved }}
      onBack={vi.fn()}
    />,
  );
  const name = screen.getByRole('textbox', { name: 'Name' });
  await user.clear(name);
  await user.type(name, 'Freelance');
  await vi.waitFor(() => {
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  });

  // act
  await user.click(screen.getByRole('button', { name: 'Save changes' }));

  // assert
  expect(await screen.findByRole('textbox', { name: 'Name' })).toHaveAccessibleDescription(
    'Name already exists',
  );
  expect(onSaved).not.toHaveBeenCalled();
});

test('says a name an active income source holds while it is typed and keeps Create income source disabled', async () => {
  // arrange
  let lookupQuery = new URLSearchParams();
  server.use(
    http.get('http://localhost/api/accounting/accounts', ({ request }) => {
      lookupQuery = new URL(request.url).searchParams;
      const items = lookupQuery.get('search_term') === 'Salary' ? [salary] : [];
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
    <IncomeSourceForm mode={{ kind: 'create', name: '', onCreated: vi.fn() }} onBack={vi.fn()} />,
  );
  const name = screen.getByRole('textbox', { name: 'Name' });

  // act
  await user.type(name, 'Salary');

  // assert
  await vi.waitFor(() => {
    expect(name).toHaveAccessibleDescription('An active income source already has this name');
  });
  expect(screen.getByRole('button', { name: 'Create income source' })).toBeDisabled();
  expect(lookupQuery.getAll('kinds')).toEqual(['INCOME']);
  expect(lookupQuery.getAll('statuses')).toEqual(['ACTIVE']);
  // a name that differs only by one letter is free
  await user.type(name, 's');
  await vi.waitFor(() => {
    expect(screen.getByRole('button', { name: 'Create income source' })).toBeEnabled();
  });
  expect(name).not.toHaveAccessibleDescription();
});

test('leaves the edited income source out of the names it finds taken', async () => {
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
  );

  // act
  render(
    <IncomeSourceForm
      mode={{ kind: 'edit', incomeSource: salary, relatedQueryKeys: [], onSaved: vi.fn() }}
      onBack={vi.fn()}
    />,
  );

  // assert
  await vi.waitFor(() => {
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  });
  expect(screen.getByRole('textbox', { name: 'Name' })).not.toHaveAccessibleDescription();
});
