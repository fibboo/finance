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
        name="Travel card"
        accountKinds={accountKinds}
        currencies={currencies}
        baseCurrency="USD"
        onCreated={onCreated}
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
      name="Travel card"
      accountKinds={accountKinds}
      currencies={currencies}
      baseCurrency="EUR"
      onCreated={vi.fn()}
      onBack={vi.fn()}
    />,
  );

  // assert
  expect(screen.getByRole('combobox', { name: 'Currency' })).toHaveValue('EUR');
  expect(screen.getByRole('radio', { name: 'Asset' })).toBeChecked();
});
