import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import type { components } from '@/lib/api-schema';
import { render } from '@/test/render';
import { server } from '@/test/setup';

import { ExpenseForm } from './expense-form';

const euroCard = {
  name: 'Euro card',
  id: '7f0c2f4e-8c1a-4b9e-9d1f-0e6a3c2b1a04',
  user_id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
  kind: 'ASSET',
  balance: '1240.00',
  currency: 'EUR',
  color: '#5B6CD9',
  category_type: null,
  base_currency_rate: '1.1',
  status: 'ACTIVE',
  base_currency_balance: '1364.00',
} satisfies components['schemas']['Account'];

const groceries = {
  ...euroCard,
  name: 'Groceries',
  id: '3c2b1a04-8c1a-4b9e-9d1f-0e6a7f0c2f4e',
  kind: 'EXPENSE',
  balance: '0',
  currency: null,
  color: '#2E8C7A',
  category_type: 'VARIABLE',
  base_currency_rate: '0',
  base_currency_balance: '0',
} satisfies components['schemas']['Account'];

const market = {
  name: 'Central market',
  description: null,
  user_id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
  id: '9e0f1a2b-2b4f-4e6a-8c7d-5a1d9c3e3c40',
  status: 'ACTIVE',
  created_at: '2026-10-01T09:00:00Z',
  updated_at: '2026-10-01T09:00:00Z',
} satisfies components['schemas']['Location'];

const transactionTypes = [
  { key: 'EXPENSE', label: 'Expense' },
  { key: 'ADJUSTMENT', label: 'Adjustment' },
] satisfies components['schemas']['DictionaryItem'][];

const categoryTypes = [
  { key: 'VARIABLE', label: 'Variable' },
] satisfies components['schemas']['DictionaryItem'][];

const currencies = [
  { key: 'EUR', label: 'Euro' },
  { key: 'GEL', label: 'Georgian lari' },
] satisfies components['schemas']['DictionaryItem'][];

const expense = {
  id: '5a1d9c3e-2b4f-4e6a-8c7d-9e0f1a2b3c40',
  user_id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
  transaction_date: '2026-10-20',
  comment: null,
  base_currency_amount: '47.08',
  location: market,
  income_period: null,
  transaction_type: 'EXPENSE',
  status: 'ACTIVE',
  created_at: '2026-10-20T09:00:00Z',
  updated_at: '2026-10-20T09:00:00Z',
  postings: [],
} satisfies components['schemas']['Transaction'];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 20, 12));
});

afterEach(() => {
  vi.useRealTimers();
});

test.each([
  {
    paidWith: 'the account currency',
    sellerAmount: null,
    destination: { destination_amount: '42.80', destination_currency: 'EUR' },
  },
  {
    paidWith: 'another currency',
    sellerAmount: '125,50',
    destination: { destination_amount: '125.50', destination_currency: 'GEL' },
  },
])('sends an expense paid in $paidWith and closes', async ({ sellerAmount, destination }) => {
  // arrange
  let requestBody: unknown = null;
  server.use(
    http.post('http://localhost/api/accounting/transactions', async ({ request }) => {
      requestBody = await request.json();
      return HttpResponse.json(expense);
    }),
  );
  const onClose = vi.fn<() => void>();
  const user = userEvent.setup();
  render(
    <ExpenseForm
      transactionTypes={transactionTypes}
      categoryTypes={categoryTypes}
      currencies={currencies}
      moneyAccounts={[euroCard]}
      categories={[groceries]}
      locations={[market]}
      baseCurrency="USD"
      relatedQueryKeys={[]}
      onTypeChange={vi.fn()}
      onClose={onClose}
    />,
  );
  await user.type(screen.getByLabelText('Amount'), '42.80');
  await user.click(screen.getByRole('button', { name: /^From/ }));
  await user.click(screen.getByRole('button', { name: /^Euro card/ }));
  await user.click(screen.getByRole('button', { name: /^Category/ }));
  await user.click(screen.getByRole('button', { name: /^Groceries/ }));
  await user.click(screen.getByRole('button', { name: /^Location/ }));
  await user.click(screen.getByRole('button', { name: /^Central market/ }));
  if (sellerAmount !== null) {
    await user.click(screen.getByRole('checkbox', { name: 'Paid in another currency' }));
    await user.type(screen.getByLabelText('Seller’s amount'), sellerAmount);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Seller’s currency' }), 'GEL');
  }

  // act
  await user.click(screen.getByRole('button', { name: 'Add expense' }));

  // assert
  await waitFor(() => {
    expect(onClose).toHaveBeenCalled();
  });
  expect(requestBody).toEqual({
    from_account_id: euroCard.id,
    to_account_id: groceries.id,
    location_id: market.id,
    source_amount: '42.80',
    source_currency: 'EUR',
    ...destination,
    transaction_date: '2026-10-20',
    comment: null,
  });
});

test('shows the amount in the base currency at the account rate', async () => {
  // arrange
  const user = userEvent.setup();
  render(
    <ExpenseForm
      transactionTypes={transactionTypes}
      categoryTypes={categoryTypes}
      currencies={currencies}
      moneyAccounts={[euroCard]}
      categories={[groceries]}
      locations={[market]}
      baseCurrency="USD"
      relatedQueryKeys={[]}
      onTypeChange={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  await user.click(screen.getByRole('button', { name: /^From/ }));
  await user.click(screen.getByRole('button', { name: /^Euro card/ }));

  // act
  await user.type(screen.getByLabelText('Amount'), '42.80');

  // assert
  expect(screen.getByLabelText('Amount')).toHaveAccessibleDescription('≈ $47.08');
});

test('asks for the category, the location and the seller’s currency before sending', async () => {
  // arrange
  let isRequestSent = false;
  server.use(
    http.post('http://localhost/api/accounting/transactions', () => {
      isRequestSent = true;
      return HttpResponse.json(expense);
    }),
  );
  const user = userEvent.setup();
  render(
    <ExpenseForm
      transactionTypes={transactionTypes}
      categoryTypes={categoryTypes}
      currencies={currencies}
      moneyAccounts={[euroCard]}
      categories={[groceries]}
      locations={[market]}
      baseCurrency="USD"
      relatedQueryKeys={[]}
      onTypeChange={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  await user.type(screen.getByLabelText('Amount'), '42.80');
  await user.click(screen.getByRole('button', { name: /^From/ }));
  await user.click(screen.getByRole('button', { name: /^Euro card/ }));
  await user.click(screen.getByRole('checkbox', { name: 'Paid in another currency' }));
  await user.type(screen.getByLabelText('Seller’s amount'), '125.50');

  // act
  await user.click(screen.getByRole('button', { name: 'Add expense' }));

  // assert
  await waitFor(() => {
    expect(screen.getByRole('button', { name: /^Category/ })).toHaveAccessibleDescription(
      'Choose a category',
    );
  });
  expect(screen.getByRole('button', { name: /^Location/ })).toHaveAccessibleDescription(
    'Choose a location',
  );
  expect(screen.getByLabelText('Seller’s amount')).toHaveAccessibleDescription(
    'Choose the seller’s currency',
  );
  expect(isRequestSent).toBe(false);
});

test('lists the categories with their category type', async () => {
  // arrange
  const user = userEvent.setup();
  render(
    <ExpenseForm
      transactionTypes={transactionTypes}
      categoryTypes={categoryTypes}
      currencies={currencies}
      moneyAccounts={[euroCard]}
      categories={[groceries]}
      locations={[market]}
      baseCurrency="USD"
      relatedQueryKeys={[]}
      onTypeChange={vi.fn()}
      onClose={vi.fn()}
    />,
  );

  // act
  await user.click(screen.getByRole('button', { name: /^Category/ }));

  // assert
  expect(screen.getByRole('button', { name: /^Groceries/ })).toHaveTextContent('GroceriesVariable');
});

test('shows a field error of the backend at its field', async () => {
  // arrange
  server.use(
    http.post('http://localhost/api/accounting/transactions', () =>
      HttpResponse.json(
        { detail: [{ loc: ['body', 'location_id'], msg: 'Input should be a valid UUID' }] },
        { status: 422 },
      ),
    ),
  );
  const user = userEvent.setup();
  render(
    <ExpenseForm
      transactionTypes={transactionTypes}
      categoryTypes={categoryTypes}
      currencies={currencies}
      moneyAccounts={[euroCard]}
      categories={[groceries]}
      locations={[market]}
      baseCurrency="USD"
      relatedQueryKeys={[]}
      onTypeChange={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  await user.type(screen.getByLabelText('Amount'), '42.80');
  await user.click(screen.getByRole('button', { name: /^From/ }));
  await user.click(screen.getByRole('button', { name: /^Euro card/ }));
  await user.click(screen.getByRole('button', { name: /^Category/ }));
  await user.click(screen.getByRole('button', { name: /^Groceries/ }));
  await user.click(screen.getByRole('button', { name: /^Location/ }));
  await user.click(screen.getByRole('button', { name: /^Central market/ }));

  // act
  await user.click(screen.getByRole('button', { name: 'Add expense' }));

  // assert
  await screen.findByText('Input should be a valid UUID');
  expect(screen.getByRole('button', { name: /^Location/ })).toHaveAccessibleDescription(
    'Input should be a valid UUID',
  );
});
