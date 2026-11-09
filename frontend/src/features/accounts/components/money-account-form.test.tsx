import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { expect, test, vi } from 'vitest';

import type { components } from '@/lib/api-schema';
import { render } from '@/test/render';
import { server } from '@/test/setup';

import { MoneyAccountForm } from './money-account-form';

const wallet = {
  name: 'Wallet',
  id: '7f0c2f4e-8c1a-4b9e-9d1f-0e6a3c2b1a03',
  user_id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
  kind: 'ASSET',
  balance: '0',
  currency: 'USD',
  color: '#4D8FBF',
  category_type: null,
  base_currency_rate: '1',
  status: 'ACTIVE',
  base_currency_balance: '0',
} satisfies components['schemas']['Account'];

const creditCard = {
  ...wallet,
  name: 'Credit card',
  id: '8c1a7f0c-2f4e-4b9e-9d1f-0e6a3c2b1a04',
  kind: 'LIABILITY',
  color: '#2E8C7A',
} satisfies components['schemas']['Account'];

const travelCard = {
  ...wallet,
  name: 'Travel card',
  id: '2f4e8c1a-7f0c-4b9e-9d1f-0e6a3c2b1a05',
  color: '#5B6CD9',
} satisfies components['schemas']['Account'];

const accountKinds = [
  { key: 'ASSET', label: 'Asset' },
  { key: 'LIABILITY', label: 'Liability' },
  { key: 'EQUITY', label: 'Equity' },
  { key: 'INCOME', label: 'Income' },
  { key: 'EXPENSE', label: 'Expense' },
];

const currencies = [
  { key: 'USD', label: 'US Dollar' },
  { key: 'EUR', label: 'Euro' },
];

test.each([
  {
    kindLabel: 'Asset',
    kind: 'ASSET',
    currency: 'USD',
    hint: 'Money you have: a card, cash or savings.',
    placeholder: 'e.g. Debit card for everyday spending',
  },
  {
    kindLabel: 'Liability',
    kind: 'LIABILITY',
    currency: 'EUR',
    hint: 'Money you owe: a credit card or a loan.',
    placeholder: 'e.g. Credit card, repaid every month',
  },
])(
  'creates an $kindLabel account in $currency with the hint of its kind',
  async ({ kindLabel, kind, currency, hint, placeholder }) => {
    // arrange
    let createdAccount: unknown = null;
    let requestedKinds: string[] = [];
    const onCreated = vi.fn();
    server.use(
      http.get('http://localhost/api/accounting/accounts', ({ request }) => {
        requestedKinds = new URL(request.url).searchParams.getAll('kinds');
        return HttpResponse.json({
          items: [wallet, creditCard],
          total: 2,
          page: 1,
          size: 100,
          pages: 1,
        } satisfies components['schemas']['Page_Account_']);
      }),
      http.post('http://localhost/api/accounting/accounts', async ({ request }) => {
        createdAccount = await request.json();
        return HttpResponse.json(travelCard satisfies components['schemas']['Account'], {
          status: 201,
        });
      }),
    );
    const user = userEvent.setup();
    render(
      <MoneyAccountForm
        mode={{ kind: 'create', name: 'Travel card', onCreated }}
        accountKinds={accountKinds}
        currencies={currencies}
        baseCurrency="USD"
        onBack={vi.fn()}
      />,
    );
    await screen.findByText('Dimmed colors are used by other accounts.');
    await user.click(screen.getByRole('radio', { name: kindLabel }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Currency' }), currency);

    // act
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    // assert
    await vi.waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith(travelCard.id);
    });
    expect(screen.queryByRole('radio', { name: 'Equity' })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Kind' })).toHaveAccessibleDescription(hint);
    expect(screen.getByRole('textbox', { name: /^Description/ })).toHaveAttribute(
      'placeholder',
      placeholder,
    );
    expect(requestedKinds).toEqual(['ASSET', 'LIABILITY']);
    expect(createdAccount).toEqual({
      name: 'Travel card',
      description: null,
      kind,
      currency,
      color: '#5B6CD9',
    });
  },
);

test('starts as an asset in the base currency', () => {
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
  );

  // act
  render(
    <MoneyAccountForm
      mode={{ kind: 'create', name: 'Travel card', onCreated: vi.fn() }}
      accountKinds={accountKinds}
      currencies={currencies}
      baseCurrency="EUR"
      onBack={vi.fn()}
    />,
  );

  // assert
  expect(screen.getByRole('combobox', { name: 'Currency' })).toHaveValue('EUR');
  expect(screen.getByRole('radio', { name: 'Asset' })).toBeChecked();
});

test('edits the name, color and description of an account and keeps its kind and currency', async () => {
  // arrange
  let updatedAccount: unknown = null;
  let updatePath = '';
  const onSaved = vi.fn();
  const euroWallet = { ...wallet, currency: 'EUR', description: 'Cash at home' };
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items: [euroWallet, creditCard],
        total: 2,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']),
    ),
    http.put('http://localhost/api/accounting/accounts/:accountId', async ({ request }) => {
      updatePath = new URL(request.url).pathname;
      updatedAccount = await request.json();
      return HttpResponse.json({ ...euroWallet, name: 'Pocket' });
    }),
  );
  const user = userEvent.setup();
  render(
    <MoneyAccountForm
      mode={{ kind: 'edit', account: euroWallet, relatedQueryKeys: [], onSaved }}
      accountKinds={accountKinds}
      currencies={currencies}
      baseCurrency="USD"
      onBack={vi.fn()}
    />,
  );
  await screen.findByText('Dimmed colors are used by other accounts.');
  const nameField = screen.getByRole('textbox', { name: 'Name' });
  await user.clear(nameField);
  await user.type(nameField, 'Pocket');
  await user.click(screen.getByRole('radio', { name: 'Indigo' }));

  // act
  await user.click(screen.getByRole('button', { name: 'Save changes' }));

  // assert
  await vi.waitFor(() => {
    expect(onSaved).toHaveBeenCalled();
  });
  expect(screen.getByRole('heading', { name: 'Edit account' })).toBeInTheDocument();
  expect(screen.getByText('Asset · EUR')).toBeInTheDocument();
  expect(screen.queryByRole('combobox', { name: 'Currency' })).not.toBeInTheDocument();
  expect(screen.getByRole('radio', { name: 'Blue' })).toBeEnabled();
  expect(screen.getByRole('radio', { name: 'Teal' })).toBeDisabled();
  expect(updatePath).toBe(`/api/accounting/accounts/${wallet.id}`);
  expect(updatedAccount).toEqual({
    name: 'Pocket',
    description: 'Cash at home',
    color: '#5B6CD9',
  });
});

test('starts the edit with the color of the account and shows a taken name at the name field', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items: [wallet, creditCard],
        total: 2,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']),
    ),
    http.put('http://localhost/api/accounting/accounts/:accountId', () =>
      HttpResponse.json(
        { error_code: 'NAME_ALREADY_EXISTS', message: 'An account with this name already exists' },
        { status: 409 },
      ),
    ),
  );
  const user = userEvent.setup();
  render(
    <MoneyAccountForm
      mode={{ kind: 'edit', account: wallet, relatedQueryKeys: [], onSaved: vi.fn() }}
      accountKinds={accountKinds}
      currencies={currencies}
      baseCurrency="USD"
      onBack={vi.fn()}
    />,
  );
  await screen.findByText('Dimmed colors are used by other accounts.');
  expect(screen.getByRole('radio', { name: 'Blue' })).toBeChecked();

  // act
  await user.click(screen.getByRole('button', { name: 'Save changes' }));

  // assert
  expect(await screen.findByText('An account with this name already exists')).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Name' })).toHaveAttribute('aria-invalid', 'true');
});

test.each([
  { case: 'shares its color with another account', color: '#4D8FBF' },
  { case: 'has no color', color: null },
])('keeps the color of an account that $case when only its name changes', async ({ color }) => {
  // arrange
  let updatedAccount: unknown = null;
  const onSaved = vi.fn();
  const account = { ...wallet, color };
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items: [account, { ...creditCard, color: '#4D8FBF' }],
        total: 2,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']),
    ),
    http.put('http://localhost/api/accounting/accounts/:accountId', async ({ request }) => {
      updatedAccount = await request.json();
      return HttpResponse.json({ ...account, name: 'Pocket' });
    }),
  );
  const user = userEvent.setup();
  render(
    <MoneyAccountForm
      mode={{ kind: 'edit', account, relatedQueryKeys: [], onSaved }}
      accountKinds={accountKinds}
      currencies={currencies}
      baseCurrency="USD"
      onBack={vi.fn()}
    />,
  );
  await screen.findByText('Dimmed colors are used by other accounts.');
  const nameField = screen.getByRole('textbox', { name: 'Name' });
  await user.clear(nameField);
  await user.type(nameField, 'Pocket');
  // switching away and back shows the own color stays selectable
  await user.click(screen.getByRole('radio', { name: 'Indigo' }));
  await user.click(screen.getByRole('radio', { name: 'Blue' }));

  // act
  await user.click(screen.getByRole('button', { name: 'Save changes' }));

  // assert
  await vi.waitFor(() => {
    expect(onSaved).toHaveBeenCalled();
  });
  expect(screen.getByRole('radio', { name: 'Blue' })).toBeEnabled();
  expect(updatedAccount).toEqual({ name: 'Pocket', description: null, color: '#4D8FBF' });
});

test('counts an account without a color as using the first color', async () => {
  // arrange
  let createdAccount: unknown = null;
  const onCreated = vi.fn();
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items: [{ ...wallet, color: null }],
        total: 1,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']),
    ),
    http.post('http://localhost/api/accounting/accounts', async ({ request }) => {
      createdAccount = await request.json();
      return HttpResponse.json(creditCard, { status: 201 });
    }),
  );
  const user = userEvent.setup();
  render(
    <MoneyAccountForm
      mode={{ kind: 'create', name: 'Credit card', onCreated }}
      accountKinds={accountKinds}
      currencies={currencies}
      baseCurrency="USD"
      onBack={vi.fn()}
    />,
  );
  await screen.findByText('Dimmed colors are used by other accounts.');

  // act
  await user.click(screen.getByRole('button', { name: 'Create account' }));

  // assert
  await vi.waitFor(() => {
    expect(onCreated).toHaveBeenCalledWith(creditCard.id);
  });
  expect(screen.getByRole('radio', { name: 'Blue' })).toBeDisabled();
  expect(createdAccount).toEqual({
    name: 'Credit card',
    description: null,
    kind: 'ASSET',
    currency: 'USD',
    color: '#2E8C7A',
  });
});
