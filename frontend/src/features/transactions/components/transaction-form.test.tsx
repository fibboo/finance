import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import type { components } from '@/lib/api-schema';
import { render } from '@/test/render';
import { server } from '@/test/setup';

import { TransactionForm } from './transaction-form';

const wallet = {
  name: 'Wallet',
  id: '7f0c2f4e-8c1a-4b9e-9d1f-0e6a3c2b1a03',
  user_id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
  kind: 'ASSET',
  balance: '412.50',
  currency: 'USD',
  color: '#2E8C7A',
  category_type: null,
  base_currency_rate: '1',
  status: 'ACTIVE',
  base_currency_balance: '412.50',
} satisfies components['schemas']['Account'];

const euroCard = {
  ...wallet,
  name: 'Euro card',
  id: '7f0c2f4e-8c1a-4b9e-9d1f-0e6a3c2b1a04',
  balance: '0',
  currency: 'EUR',
  base_currency_rate: '0',
  base_currency_balance: '0',
} satisfies components['schemas']['Account'];

const transactionTypes = [
  { key: 'EXPENSE', label: 'Expense' },
  { key: 'TRANSFER', label: 'Transfer' },
  { key: 'ADJUSTMENT', label: 'Adjustment' },
] satisfies components['schemas']['DictionaryItem'][];

const adjustment = {
  id: '5a1d9c3e-2b4f-4e6a-8c7d-9e0f1a2b3c40',
  user_id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
  transaction_date: '2026-10-20',
  comment: null,
  base_currency_amount: '32.50',
  location: null,
  income_period: null,
  transaction_type: 'ADJUSTMENT',
  status: 'ACTIVE',
  created_at: '2026-10-20T09:00:00Z',
  updated_at: '2026-10-20T09:00:00Z',
  postings: [],
} satisfies components['schemas']['Transaction'];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 20, 12));
  server.use(
    http.get('http://localhost/api/accounting/accounts/:accountId', ({ params }) =>
      HttpResponse.json(params['accountId'] === wallet.id ? wallet : euroCard),
    ),
  );
});

afterEach(() => {
  vi.useRealTimers();
});

test('sends the new balance of the chosen account and closes', async () => {
  // arrange
  let requestBody: unknown = null;
  let requestPath = '';
  server.use(
    http.post(
      'http://localhost/api/accounting/accounts/:accountId/adjustment',
      async ({ request }) => {
        requestPath = new URL(request.url).pathname;
        requestBody = await request.json();
        return HttpResponse.json(adjustment);
      },
    ),
  );
  const onClose = vi.fn<() => void>();
  const user = userEvent.setup();
  render(
    <TransactionForm
      transactionType="ADJUSTMENT"
      transactionTypes={transactionTypes}
      moneyAccounts={[wallet, euroCard]}
      presetAccountId={undefined}
      baseCurrency="USD"
      relatedQueryKeys={[]}
      renderMoneyAccountForm={() => null}
      onTypeChange={vi.fn()}
      onClose={onClose}
    />,
  );
  await user.click(screen.getByRole('button', { name: /^Account/ }));
  await user.click(screen.getByRole('button', { name: /^Wallet/ }));
  await user.type(screen.getByLabelText('New balance'), '380');
  await user.type(screen.getByLabelText('Comment'), 'Cash count');

  // act
  await user.click(screen.getByRole('button', { name: 'Adjust balance' }));

  // assert
  await waitFor(() => {
    expect(onClose).toHaveBeenCalled();
  });
  expect(requestPath).toBe(`/api/accounting/accounts/${wallet.id}/adjustment`);
  expect(requestBody).toEqual({
    transaction_date: '2026-10-20',
    comment: 'Cash count',
    new_balance: '380.00',
    base_currency_amount: null,
  });
});

test('shows the current balance and the difference the new balance makes', async () => {
  // arrange
  const user = userEvent.setup();
  render(
    <TransactionForm
      transactionType="ADJUSTMENT"
      transactionTypes={transactionTypes}
      moneyAccounts={[wallet]}
      presetAccountId={undefined}
      baseCurrency="USD"
      relatedQueryKeys={[]}
      renderMoneyAccountForm={() => null}
      onTypeChange={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  await user.click(screen.getByRole('button', { name: /^Account/ }));
  await user.click(screen.getByRole('button', { name: /^Wallet/ }));

  // act
  await user.type(screen.getByLabelText('New balance'), '380');

  // assert
  expect(screen.getByText('Now $412.50 · -$32.50')).toBeInTheDocument();
});

test('asks for the base currency amount of an account without a rate', async () => {
  // arrange
  let requestBody: unknown = null;
  server.use(
    http.post(
      'http://localhost/api/accounting/accounts/:accountId/adjustment',
      async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json(adjustment);
      },
    ),
  );
  const onClose = vi.fn<() => void>();
  const user = userEvent.setup();
  render(
    <TransactionForm
      transactionType="ADJUSTMENT"
      transactionTypes={transactionTypes}
      moneyAccounts={[wallet, euroCard]}
      presetAccountId={undefined}
      baseCurrency="USD"
      relatedQueryKeys={[]}
      renderMoneyAccountForm={() => null}
      onTypeChange={vi.fn()}
      onClose={onClose}
    />,
  );
  await user.click(screen.getByRole('button', { name: /^Account/ }));
  await user.click(screen.getByRole('button', { name: /^Euro card/ }));
  await user.type(screen.getByLabelText('New balance'), '100');

  // act
  await user.type(screen.getByLabelText('In USD'), '108,40');
  await user.click(screen.getByRole('button', { name: 'Adjust balance' }));

  // assert
  await waitFor(() => {
    expect(onClose).toHaveBeenCalled();
  });
  expect(requestBody).toEqual({
    transaction_date: '2026-10-20',
    comment: null,
    new_balance: '100.00',
    base_currency_amount: '108.40',
  });
});

test.each([
  { field: 'Account', typed: '', error: 'Choose the account to adjust' },
  { field: 'New balance', typed: '-', error: 'Enter the new balance, like 1180.50' },
  { field: 'Comment', typed: 'ok', error: 'Write at least 3 characters' },
])('refuses to send when $field is not valid', async ({ field, typed, error }) => {
  // arrange
  const user = userEvent.setup();
  render(
    <TransactionForm
      transactionType="ADJUSTMENT"
      transactionTypes={transactionTypes}
      moneyAccounts={[wallet]}
      presetAccountId={undefined}
      baseCurrency="USD"
      relatedQueryKeys={[]}
      renderMoneyAccountForm={() => null}
      onTypeChange={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  if (typed !== '') {
    await user.type(screen.getByLabelText(field), typed);
  }

  // act
  await user.click(screen.getByRole('button', { name: 'Adjust balance' }));

  // assert
  expect(await screen.findByText(error)).toBeInTheDocument();
});

test('refuses a new balance equal to the current one', async () => {
  // arrange
  const user = userEvent.setup();
  render(
    <TransactionForm
      transactionType="ADJUSTMENT"
      transactionTypes={transactionTypes}
      moneyAccounts={[wallet]}
      presetAccountId={undefined}
      baseCurrency="USD"
      relatedQueryKeys={[]}
      renderMoneyAccountForm={() => null}
      onTypeChange={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  await user.click(screen.getByRole('button', { name: /^Account/ }));
  await user.click(screen.getByRole('button', { name: /^Wallet/ }));
  await user.type(screen.getByLabelText('New balance'), '412.5');

  // act
  await user.click(screen.getByRole('button', { name: 'Adjust balance' }));

  // assert
  expect(await screen.findByText('The account already has this balance')).toBeInTheDocument();
});

test('shows a field error of the backend at its field', async () => {
  // arrange
  server.use(
    http.post('http://localhost/api/accounting/accounts/:accountId/adjustment', () =>
      HttpResponse.json(
        {
          detail: [{ loc: ['body', 'comment'], msg: 'String should have at most 256 characters' }],
        },
        { status: 422 },
      ),
    ),
  );
  const user = userEvent.setup();
  render(
    <TransactionForm
      transactionType="ADJUSTMENT"
      transactionTypes={transactionTypes}
      moneyAccounts={[wallet]}
      presetAccountId={undefined}
      baseCurrency="USD"
      relatedQueryKeys={[]}
      renderMoneyAccountForm={() => null}
      onTypeChange={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  await user.click(screen.getByRole('button', { name: /^Account/ }));
  await user.click(screen.getByRole('button', { name: /^Wallet/ }));
  await user.type(screen.getByLabelText('New balance'), '380');
  await user.type(screen.getByLabelText('Comment'), 'Cash count');

  // act
  await user.click(screen.getByRole('button', { name: 'Adjust balance' }));

  // assert
  await screen.findByText('String should have at most 256 characters');
  expect(screen.getByLabelText('Comment')).toHaveAccessibleDescription(
    'String should have at most 256 characters',
  );
});

test('finds an account by a part of its name', async () => {
  // arrange
  const user = userEvent.setup();
  render(
    <TransactionForm
      transactionType="ADJUSTMENT"
      transactionTypes={transactionTypes}
      moneyAccounts={[wallet, euroCard]}
      presetAccountId={undefined}
      baseCurrency="USD"
      relatedQueryKeys={[]}
      renderMoneyAccountForm={() => null}
      onTypeChange={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  await user.click(screen.getByRole('button', { name: /^Account/ }));

  // act
  await user.type(screen.getByRole('searchbox', { name: 'Search accounts' }), 'eur');

  // assert
  expect(screen.getAllByRole('button', { name: /€|\$/ }).map((item) => item.textContent)).toEqual([
    'Euro card€0.00',
  ]);
});

test('offers only the transaction types the form can enter', () => {
  // act
  render(
    <TransactionForm
      transactionType="ADJUSTMENT"
      transactionTypes={transactionTypes}
      moneyAccounts={[wallet]}
      presetAccountId={undefined}
      baseCurrency="USD"
      relatedQueryKeys={[]}
      renderMoneyAccountForm={() => null}
      onTypeChange={vi.fn()}
      onClose={vi.fn()}
    />,
  );

  // assert
  expect(screen.getAllByRole('radio').map((radio) => radio.parentElement?.textContent)).toEqual([
    'Expense',
    'Transfer',
    'Adjustment',
  ]);
});

test('asks for the base currency amount when the account had no rate on the date', async () => {
  // arrange
  const requestBodies: unknown[] = [];
  server.use(
    http.post(
      'http://localhost/api/accounting/accounts/:accountId/adjustment',
      async ({ request }) => {
        requestBodies.push(await request.json());
        return requestBodies.length === 1
          ? HttpResponse.json(
              {
                message: 'Accounts has no base currency rate',
                error_code: 'NO_ACCOUNT_BASE_CURRENCY_RATE',
              },
              { status: 403 },
            )
          : HttpResponse.json(adjustment);
      },
    ),
  );
  server.use(
    http.get(`http://localhost/api/accounting/accounts/${euroCard.id}`, () =>
      HttpResponse.json({ ...euroCard, balance: '50', base_currency_rate: '0.92' }),
    ),
  );
  const onClose = vi.fn<() => void>();
  const user = userEvent.setup();
  render(
    <TransactionForm
      transactionType="ADJUSTMENT"
      transactionTypes={transactionTypes}
      moneyAccounts={[{ ...euroCard, balance: '50', base_currency_rate: '0.92' }]}
      presetAccountId={undefined}
      baseCurrency="USD"
      relatedQueryKeys={[]}
      renderMoneyAccountForm={() => null}
      onTypeChange={vi.fn()}
      onClose={onClose}
    />,
  );
  await user.click(screen.getByRole('button', { name: /^Account/ }));
  await user.click(screen.getByRole('button', { name: /^Euro card/ }));
  await user.type(screen.getByLabelText('New balance'), '100');
  await user.click(screen.getByRole('button', { name: 'Adjust balance' }));
  await user.type(await screen.findByLabelText('In USD'), '54.30');

  // act
  await user.click(screen.getByRole('button', { name: 'Adjust balance' }));

  // assert
  await waitFor(() => {
    expect(onClose).toHaveBeenCalled();
  });
  expect(requestBodies.at(-1)).toEqual({
    transaction_date: '2026-10-20',
    comment: null,
    new_balance: '100.00',
    base_currency_amount: '54.30',
  });
});

test('refuses a date after today', async () => {
  // arrange
  const user = userEvent.setup();
  render(
    <TransactionForm
      transactionType="ADJUSTMENT"
      transactionTypes={transactionTypes}
      moneyAccounts={[wallet]}
      presetAccountId={undefined}
      baseCurrency="USD"
      relatedQueryKeys={[]}
      renderMoneyAccountForm={() => null}
      onTypeChange={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  await user.clear(screen.getByLabelText('Date'));
  await user.type(screen.getByLabelText('Date'), '21102026');

  // act
  await user.click(screen.getByRole('button', { name: 'Adjust balance' }));

  // assert
  expect(await screen.findByText('Choose a date up to today')).toBeInTheDocument();
});

test('drops the base currency amount typed for another account', async () => {
  // arrange
  let requestBody: unknown = null;
  server.use(
    http.post(
      'http://localhost/api/accounting/accounts/:accountId/adjustment',
      async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json(adjustment);
      },
    ),
  );
  const onClose = vi.fn<() => void>();
  const user = userEvent.setup();
  render(
    <TransactionForm
      transactionType="ADJUSTMENT"
      transactionTypes={transactionTypes}
      moneyAccounts={[wallet, euroCard]}
      presetAccountId={undefined}
      baseCurrency="USD"
      relatedQueryKeys={[]}
      renderMoneyAccountForm={() => null}
      onTypeChange={vi.fn()}
      onClose={onClose}
    />,
  );
  await user.click(screen.getByRole('button', { name: /^Account/ }));
  await user.click(screen.getByRole('button', { name: /^Euro card/ }));
  await user.type(screen.getByLabelText('In USD'), '42.80');
  await user.click(screen.getByRole('button', { name: /^Account/ }));
  await user.click(screen.getByRole('button', { name: /^Wallet/ }));
  await user.type(screen.getByLabelText('New balance'), '380');

  // act
  await user.click(screen.getByRole('button', { name: 'Adjust balance' }));

  // assert
  await waitFor(() => {
    expect(onClose).toHaveBeenCalled();
  });
  expect(requestBody).toEqual({
    transaction_date: '2026-10-20',
    comment: null,
    new_balance: '380.00',
    base_currency_amount: null,
  });
});

test('starts with the preset account chosen and adjusts its balance', async () => {
  // arrange
  let requestPath = '';
  server.use(
    http.post('http://localhost/api/accounting/accounts/:accountId/adjustment', ({ request }) => {
      requestPath = new URL(request.url).pathname;
      return HttpResponse.json(adjustment);
    }),
  );
  const onClose = vi.fn<() => void>();
  const user = userEvent.setup();
  render(
    <TransactionForm
      transactionType="ADJUSTMENT"
      transactionTypes={transactionTypes}
      moneyAccounts={[wallet, euroCard]}
      presetAccountId={euroCard.id}
      baseCurrency="USD"
      relatedQueryKeys={[]}
      renderMoneyAccountForm={() => null}
      onTypeChange={vi.fn()}
      onClose={onClose}
    />,
  );
  await user.type(screen.getByLabelText('New balance'), '15');

  // act
  await user.click(screen.getByRole('button', { name: 'Adjust balance' }));

  // assert
  await waitFor(() => {
    expect(onClose).toHaveBeenCalled();
  });
  expect(screen.getByRole('button', { name: /^Account/ })).toHaveTextContent('Euro card');
  expect(requestPath).toBe(`/api/accounting/accounts/${euroCard.id}/adjustment`);
});

test('asks for the account when the preset account is not a money account', async () => {
  // arrange
  const user = userEvent.setup();
  render(
    <TransactionForm
      transactionType="ADJUSTMENT"
      transactionTypes={transactionTypes}
      moneyAccounts={[wallet]}
      presetAccountId={euroCard.id}
      baseCurrency="USD"
      relatedQueryKeys={[]}
      renderMoneyAccountForm={() => null}
      onTypeChange={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  await user.type(screen.getByLabelText('New balance'), '15');

  // act
  await user.click(screen.getByRole('button', { name: 'Adjust balance' }));

  // assert
  expect(await screen.findByText('Choose the account to adjust')).toBeInTheDocument();
});

test('keeps Adjust balance disabled until the money accounts have loaded', () => {
  // act
  render(
    <TransactionForm
      transactionType="ADJUSTMENT"
      transactionTypes={transactionTypes}
      moneyAccounts={undefined}
      presetAccountId={euroCard.id}
      baseCurrency="USD"
      relatedQueryKeys={[]}
      renderMoneyAccountForm={() => null}
      onTypeChange={vi.fn()}
      onClose={vi.fn()}
    />,
  );

  // assert
  expect(screen.getByRole('button', { name: 'Adjust balance' })).toBeDisabled();
});

test.each([
  { typed: '-1250.5', shown: '-1,250.5' },
  { typed: '-12a', shown: '-12' },
  { typed: '12-', shown: '12' },
])('shows the typed new balance $typed as $shown', async ({ typed, shown }) => {
  // arrange
  const user = userEvent.setup();
  render(
    <TransactionForm
      transactionType="ADJUSTMENT"
      transactionTypes={transactionTypes}
      moneyAccounts={[wallet]}
      presetAccountId={undefined}
      baseCurrency="USD"
      relatedQueryKeys={[]}
      renderMoneyAccountForm={() => null}
      onTypeChange={vi.fn()}
      onClose={vi.fn()}
    />,
  );

  // act
  await user.type(screen.getByLabelText('New balance'), typed);

  // assert
  expect(screen.getByLabelText('New balance')).toHaveValue(shown);
});

test('asks for the base currency amount once the date is one the account had no rate on', async () => {
  // arrange
  // the account has a rate from 06.10.2026 on, and none up to 05.10.2026
  const ratedEuroCard = { ...euroCard, balance: '50', base_currency_rate: '0.92' };
  server.use(
    http.get(`http://localhost/api/accounting/accounts/${euroCard.id}`, ({ request }) => {
      const date = new URL(request.url).searchParams.get('date') ?? '';
      return HttpResponse.json(date >= '2026-10-06' ? ratedEuroCard : euroCard);
    }),
  );
  const user = userEvent.setup();
  render(
    <TransactionForm
      transactionType="ADJUSTMENT"
      transactionTypes={transactionTypes}
      moneyAccounts={[ratedEuroCard]}
      presetAccountId={euroCard.id}
      baseCurrency="USD"
      relatedQueryKeys={[]}
      renderMoneyAccountForm={() => null}
      onTypeChange={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  const shownOnDates: boolean[] = [];

  // act
  await user.clear(screen.getByLabelText('Date'));
  await user.type(screen.getByLabelText('Date'), '05102026');
  await screen.findByLabelText('In USD');
  shownOnDates.push(screen.queryByLabelText('In USD') !== null);
  await user.clear(screen.getByLabelText('Date'));
  await user.type(screen.getByLabelText('Date'), '06102026');
  await waitFor(() => {
    expect(screen.queryByLabelText('In USD')).not.toBeInTheDocument();
  });
  shownOnDates.push(screen.queryByLabelText('In USD') !== null);

  // assert
  expect(shownOnDates).toEqual([true, false]);
});

test('leaves out the base currency amount typed for a date the account had a rate on', async () => {
  // arrange
  // the account has a rate from 06.10.2026 on, and none up to 05.10.2026
  const ratedEuroCard = { ...euroCard, balance: '50', base_currency_rate: '0.92' };
  let requestBody: unknown = null;
  server.use(
    http.get(`http://localhost/api/accounting/accounts/${euroCard.id}`, ({ request }) => {
      const date = new URL(request.url).searchParams.get('date') ?? '';
      return HttpResponse.json(date >= '2026-10-06' ? ratedEuroCard : euroCard);
    }),
    http.post(
      'http://localhost/api/accounting/accounts/:accountId/adjustment',
      async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json(adjustment);
      },
    ),
  );
  const onClose = vi.fn<() => void>();
  const user = userEvent.setup();
  render(
    <TransactionForm
      transactionType="ADJUSTMENT"
      transactionTypes={transactionTypes}
      moneyAccounts={[ratedEuroCard]}
      presetAccountId={euroCard.id}
      baseCurrency="USD"
      relatedQueryKeys={[]}
      renderMoneyAccountForm={() => null}
      onTypeChange={vi.fn()}
      onClose={onClose}
    />,
  );
  await user.type(screen.getByLabelText('New balance'), '100');
  await user.clear(screen.getByLabelText('Date'));
  await user.type(screen.getByLabelText('Date'), '05102026');
  await user.type(await screen.findByLabelText('In USD'), '54.30');
  await user.clear(screen.getByLabelText('Date'));
  await user.type(screen.getByLabelText('Date'), '06102026');
  await waitFor(() => {
    expect(screen.queryByLabelText('In USD')).not.toBeInTheDocument();
  });

  // act
  await user.click(screen.getByRole('button', { name: 'Adjust balance' }));

  // assert
  await waitFor(() => {
    expect(onClose).toHaveBeenCalled();
  });
  expect(requestBody).toEqual({
    transaction_date: '2026-10-06',
    comment: null,
    new_balance: '100.00',
    base_currency_amount: null,
  });
});
