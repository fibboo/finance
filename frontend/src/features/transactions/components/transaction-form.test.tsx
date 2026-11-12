import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
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

const ratedEuroCard = {
  ...euroCard,
  balance: '50',
  base_currency_rate: '0.92',
} satisfies components['schemas']['Account'];

const adjustmentsAccount = {
  ...wallet,
  name: 'Adjustments',
  id: '7f0c2f4e-8c1a-4b9e-9d1f-0e6a3c2b1a05',
  kind: 'EQUITY',
  balance: '32.50',
  color: null,
} satisfies components['schemas']['Account'];

const walletAdjustment = {
  ...adjustment,
  transaction_date: '2026-10-18',
  comment: 'Cash count',
  base_currency_amount: '-35.20',
  postings: [
    {
      id: '6b2e0d4f-3c5a-4f7b-9d8e-0f1a2b3c4d51',
      account: wallet,
      amount: '-32.50',
      currency: 'USD',
      base_amount: '-32.50',
    },
    {
      id: '6b2e0d4f-3c5a-4f7b-9d8e-0f1a2b3c4d52',
      account: adjustmentsAccount,
      amount: '32.50',
      currency: 'USD',
      base_amount: '32.50',
    },
  ],
} satisfies components['schemas']['Transaction'];

const euroCardAdjustment = {
  ...walletAdjustment,
  postings: [
    {
      id: '6b2e0d4f-3c5a-4f7b-9d8e-0f1a2b3c4d53',
      account: ratedEuroCard,
      amount: '-32.50',
      currency: 'EUR',
      base_amount: '-35.20',
    },
    {
      id: '6b2e0d4f-3c5a-4f7b-9d8e-0f1a2b3c4d54',
      account: adjustmentsAccount,
      amount: '32.50',
      currency: 'EUR',
      base_amount: '35.20',
    },
  ],
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

test('sends the typed amount and closes', async () => {
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
      mode={{
        kind: 'create',
        typeChoice: { transactionTypes, onTypeChange: vi.fn() },
        presetAccountId: undefined,
        renderMoneyAccountForm: () => null,
      }}
      transactionType="ADJUSTMENT"
      moneyAccounts={[wallet, euroCard]}
      baseCurrency="USD"
      relatedQueryKeys={[]}
      onClose={onClose}
    />,
  );
  await user.click(screen.getByRole('button', { name: /^Account/ }));
  await user.click(screen.getByRole('button', { name: /^Wallet/ }));
  await user.type(screen.getByLabelText('Amount'), '-32.5');
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
    amount: '-32.50',
    base_currency_amount: null,
  });
});

test('shows the current balance and the balance the amount leads to', async () => {
  // arrange
  const user = userEvent.setup();
  render(
    <TransactionForm
      mode={{
        kind: 'create',
        typeChoice: { transactionTypes, onTypeChange: vi.fn() },
        presetAccountId: undefined,
        renderMoneyAccountForm: () => null,
      }}
      transactionType="ADJUSTMENT"
      moneyAccounts={[wallet]}
      baseCurrency="USD"
      relatedQueryKeys={[]}
      onClose={vi.fn()}
    />,
  );
  await user.click(screen.getByRole('button', { name: /^Account/ }));
  await user.click(screen.getByRole('button', { name: /^Wallet/ }));

  // act
  await user.type(screen.getByLabelText('Amount'), '-32.5');

  // assert
  expect(screen.getByText('Now $412.50 → $380.00')).toBeInTheDocument();
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
      mode={{
        kind: 'create',
        typeChoice: { transactionTypes, onTypeChange: vi.fn() },
        presetAccountId: undefined,
        renderMoneyAccountForm: () => null,
      }}
      transactionType="ADJUSTMENT"
      moneyAccounts={[wallet, euroCard]}
      baseCurrency="USD"
      relatedQueryKeys={[]}
      onClose={onClose}
    />,
  );
  await user.click(screen.getByRole('button', { name: /^Account/ }));
  await user.click(screen.getByRole('button', { name: /^Euro card/ }));
  await user.type(screen.getByLabelText('Amount'), '100');

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
    amount: '100.00',
    base_currency_amount: '108.40',
  });
});

test.each([
  { field: 'Account', typed: '', error: 'Choose the account to adjust' },
  { field: 'Amount', typed: '-', error: 'Enter the amount, like -150.00' },
  { field: 'Comment', typed: 'ok', error: 'Write at least 3 characters' },
])('refuses to send when $field is not valid', async ({ field, typed, error }) => {
  // arrange
  const user = userEvent.setup();
  render(
    <TransactionForm
      mode={{
        kind: 'create',
        typeChoice: { transactionTypes, onTypeChange: vi.fn() },
        presetAccountId: undefined,
        renderMoneyAccountForm: () => null,
      }}
      transactionType="ADJUSTMENT"
      moneyAccounts={[wallet]}
      baseCurrency="USD"
      relatedQueryKeys={[]}
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

test('refuses an amount of zero', async () => {
  // arrange
  const user = userEvent.setup();
  render(
    <TransactionForm
      mode={{
        kind: 'create',
        typeChoice: { transactionTypes, onTypeChange: vi.fn() },
        presetAccountId: undefined,
        renderMoneyAccountForm: () => null,
      }}
      transactionType="ADJUSTMENT"
      moneyAccounts={[wallet]}
      baseCurrency="USD"
      relatedQueryKeys={[]}
      onClose={vi.fn()}
    />,
  );
  await user.click(screen.getByRole('button', { name: /^Account/ }));
  await user.click(screen.getByRole('button', { name: /^Wallet/ }));
  await user.type(screen.getByLabelText('Amount'), '0');

  // act
  await user.click(screen.getByRole('button', { name: 'Adjust balance' }));

  // assert
  expect(await screen.findByText('Enter an amount other than zero')).toBeInTheDocument();
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
      mode={{
        kind: 'create',
        typeChoice: { transactionTypes, onTypeChange: vi.fn() },
        presetAccountId: undefined,
        renderMoneyAccountForm: () => null,
      }}
      transactionType="ADJUSTMENT"
      moneyAccounts={[wallet]}
      baseCurrency="USD"
      relatedQueryKeys={[]}
      onClose={vi.fn()}
    />,
  );
  await user.click(screen.getByRole('button', { name: /^Account/ }));
  await user.click(screen.getByRole('button', { name: /^Wallet/ }));
  await user.type(screen.getByLabelText('Amount'), '380');
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
      mode={{
        kind: 'create',
        typeChoice: { transactionTypes, onTypeChange: vi.fn() },
        presetAccountId: undefined,
        renderMoneyAccountForm: () => null,
      }}
      transactionType="ADJUSTMENT"
      moneyAccounts={[wallet, euroCard]}
      baseCurrency="USD"
      relatedQueryKeys={[]}
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
      mode={{
        kind: 'create',
        typeChoice: { transactionTypes, onTypeChange: vi.fn() },
        presetAccountId: undefined,
        renderMoneyAccountForm: () => null,
      }}
      transactionType="ADJUSTMENT"
      moneyAccounts={[wallet]}
      baseCurrency="USD"
      relatedQueryKeys={[]}
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
      mode={{
        kind: 'create',
        typeChoice: { transactionTypes, onTypeChange: vi.fn() },
        presetAccountId: undefined,
        renderMoneyAccountForm: () => null,
      }}
      transactionType="ADJUSTMENT"
      moneyAccounts={[{ ...euroCard, balance: '50', base_currency_rate: '0.92' }]}
      baseCurrency="USD"
      relatedQueryKeys={[]}
      onClose={onClose}
    />,
  );
  await user.click(screen.getByRole('button', { name: /^Account/ }));
  await user.click(screen.getByRole('button', { name: /^Euro card/ }));
  await user.type(screen.getByLabelText('Amount'), '100');
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
    amount: '100.00',
    base_currency_amount: '54.30',
  });
});

test('refuses a date after today', async () => {
  // arrange
  const user = userEvent.setup();
  render(
    <TransactionForm
      mode={{
        kind: 'create',
        typeChoice: { transactionTypes, onTypeChange: vi.fn() },
        presetAccountId: undefined,
        renderMoneyAccountForm: () => null,
      }}
      transactionType="ADJUSTMENT"
      moneyAccounts={[wallet]}
      baseCurrency="USD"
      relatedQueryKeys={[]}
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

test('leaves out the base currency amount typed for another account', async () => {
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
      mode={{
        kind: 'create',
        typeChoice: { transactionTypes, onTypeChange: vi.fn() },
        presetAccountId: undefined,
        renderMoneyAccountForm: () => null,
      }}
      transactionType="ADJUSTMENT"
      moneyAccounts={[wallet, euroCard]}
      baseCurrency="USD"
      relatedQueryKeys={[]}
      onClose={onClose}
    />,
  );
  await user.click(screen.getByRole('button', { name: /^Account/ }));
  await user.click(screen.getByRole('button', { name: /^Euro card/ }));
  await user.type(screen.getByLabelText('In USD'), '42.80');
  await user.click(screen.getByRole('button', { name: /^Account/ }));
  await user.click(screen.getByRole('button', { name: /^Wallet/ }));
  await user.type(screen.getByLabelText('Amount'), '-32.5');

  // act
  await user.click(screen.getByRole('button', { name: 'Adjust balance' }));

  // assert
  await waitFor(() => {
    expect(onClose).toHaveBeenCalled();
  });
  expect(requestBody).toEqual({
    transaction_date: '2026-10-20',
    comment: null,
    amount: '-32.50',
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
      mode={{
        kind: 'create',
        typeChoice: { transactionTypes, onTypeChange: vi.fn() },
        presetAccountId: euroCard.id,
        renderMoneyAccountForm: () => null,
      }}
      transactionType="ADJUSTMENT"
      moneyAccounts={[wallet, euroCard]}
      baseCurrency="USD"
      relatedQueryKeys={[]}
      onClose={onClose}
    />,
  );
  await user.type(screen.getByLabelText('Amount'), '15');

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
      mode={{
        kind: 'create',
        typeChoice: { transactionTypes, onTypeChange: vi.fn() },
        presetAccountId: euroCard.id,
        renderMoneyAccountForm: () => null,
      }}
      transactionType="ADJUSTMENT"
      moneyAccounts={[wallet]}
      baseCurrency="USD"
      relatedQueryKeys={[]}
      onClose={vi.fn()}
    />,
  );
  await user.type(screen.getByLabelText('Amount'), '15');

  // act
  await user.click(screen.getByRole('button', { name: 'Adjust balance' }));

  // assert
  expect(await screen.findByText('Choose the account to adjust')).toBeInTheDocument();
});

test('keeps Adjust balance disabled until the money accounts have loaded', () => {
  // act
  render(
    <TransactionForm
      mode={{
        kind: 'create',
        typeChoice: { transactionTypes, onTypeChange: vi.fn() },
        presetAccountId: euroCard.id,
        renderMoneyAccountForm: () => null,
      }}
      transactionType="ADJUSTMENT"
      moneyAccounts={undefined}
      baseCurrency="USD"
      relatedQueryKeys={[]}
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
])('shows the typed amount $typed as $shown', async ({ typed, shown }) => {
  // arrange
  const user = userEvent.setup();
  render(
    <TransactionForm
      mode={{
        kind: 'create',
        typeChoice: { transactionTypes, onTypeChange: vi.fn() },
        presetAccountId: undefined,
        renderMoneyAccountForm: () => null,
      }}
      transactionType="ADJUSTMENT"
      moneyAccounts={[wallet]}
      baseCurrency="USD"
      relatedQueryKeys={[]}
      onClose={vi.fn()}
    />,
  );

  // act
  await user.type(screen.getByLabelText('Amount'), typed);

  // assert
  expect(screen.getByLabelText('Amount')).toHaveValue(shown);
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
      mode={{
        kind: 'create',
        typeChoice: { transactionTypes, onTypeChange: vi.fn() },
        presetAccountId: euroCard.id,
        renderMoneyAccountForm: () => null,
      }}
      transactionType="ADJUSTMENT"
      moneyAccounts={[ratedEuroCard]}
      baseCurrency="USD"
      relatedQueryKeys={[]}
      onClose={vi.fn()}
    />,
  );
  await user.clear(screen.getByLabelText('Date'));

  // act
  await user.type(screen.getByLabelText('Date'), '05102026');

  // assert
  expect(await screen.findByLabelText('In USD')).toBeInTheDocument();
});

test('stops asking for the base currency amount once the date is one the account had a rate on', async () => {
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
      mode={{
        kind: 'create',
        typeChoice: { transactionTypes, onTypeChange: vi.fn() },
        presetAccountId: euroCard.id,
        renderMoneyAccountForm: () => null,
      }}
      transactionType="ADJUSTMENT"
      moneyAccounts={[ratedEuroCard]}
      baseCurrency="USD"
      relatedQueryKeys={[]}
      onClose={vi.fn()}
    />,
  );
  await user.clear(screen.getByLabelText('Date'));
  await user.type(screen.getByLabelText('Date'), '05102026');
  await screen.findByLabelText('In USD');
  await user.clear(screen.getByLabelText('Date'));

  // act
  await user.type(screen.getByLabelText('Date'), '06102026');

  // assert
  await waitFor(() => {
    expect(screen.queryByLabelText('In USD')).not.toBeInTheDocument();
  });
});

test('stops asking for the amount the backend asked for once the date changes', async () => {
  // arrange
  const ratedEuroCard = { ...euroCard, balance: '50', base_currency_rate: '0.92' };
  server.use(
    http.get(`http://localhost/api/accounting/accounts/${euroCard.id}`, () =>
      HttpResponse.json(ratedEuroCard),
    ),
    http.post('http://localhost/api/accounting/accounts/:accountId/adjustment', () =>
      HttpResponse.json(
        {
          message: 'Accounts has no base currency rate',
          error_code: 'NO_ACCOUNT_BASE_CURRENCY_RATE',
        },
        { status: 403 },
      ),
    ),
  );
  const user = userEvent.setup();
  render(
    <TransactionForm
      mode={{
        kind: 'create',
        typeChoice: { transactionTypes, onTypeChange: vi.fn() },
        presetAccountId: euroCard.id,
        renderMoneyAccountForm: () => null,
      }}
      transactionType="ADJUSTMENT"
      moneyAccounts={[ratedEuroCard]}
      baseCurrency="USD"
      relatedQueryKeys={[]}
      onClose={vi.fn()}
    />,
  );
  await user.type(screen.getByLabelText('Amount'), '100');
  await user.click(screen.getByRole('button', { name: 'Adjust balance' }));
  await screen.findByLabelText('In USD');

  // act
  await user.type(screen.getByLabelText('Date'), '19102026', {
    initialSelectionStart: 0,
    initialSelectionEnd: 10,
  });

  // assert
  await waitFor(() => {
    expect(screen.queryByLabelText('In USD')).not.toBeInTheDocument();
  });
});

test('leaves out an amount typed before the account turned out to have a rate on the date', async () => {
  // arrange
  // the listed account has no rate today, and the slower answer says it had one on the date
  const ratedEuroCard = { ...euroCard, balance: '50', base_currency_rate: '0.92' };
  let requestBody: unknown = null;
  server.use(
    http.get(`http://localhost/api/accounting/accounts/${euroCard.id}`, async () => {
      await delay(300);
      return HttpResponse.json(ratedEuroCard);
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
      mode={{
        kind: 'create',
        typeChoice: { transactionTypes, onTypeChange: vi.fn() },
        presetAccountId: euroCard.id,
        renderMoneyAccountForm: () => null,
      }}
      transactionType="ADJUSTMENT"
      moneyAccounts={[euroCard]}
      baseCurrency="USD"
      relatedQueryKeys={[]}
      onClose={onClose}
    />,
  );
  await user.type(screen.getByLabelText('In USD'), '0');
  await user.type(screen.getByLabelText('Amount'), '100');
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
    transaction_date: '2026-10-20',
    comment: null,
    amount: '100.00',
    base_currency_amount: null,
  });
});

test('keeps the typed base currency amount when the date changes', async () => {
  // arrange
  server.use(
    http.get(`http://localhost/api/accounting/accounts/${euroCard.id}`, () =>
      HttpResponse.json(euroCard),
    ),
  );
  const user = userEvent.setup();
  render(
    <TransactionForm
      mode={{
        kind: 'create',
        typeChoice: { transactionTypes, onTypeChange: vi.fn() },
        presetAccountId: euroCard.id,
        renderMoneyAccountForm: () => null,
      }}
      transactionType="ADJUSTMENT"
      moneyAccounts={[euroCard]}
      baseCurrency="USD"
      relatedQueryKeys={[]}
      onClose={vi.fn()}
    />,
  );
  await user.type(screen.getByLabelText('In USD'), '42.80');

  // act
  await user.type(screen.getByLabelText('Date'), '19102026', {
    initialSelectionStart: 0,
    initialSelectionEnd: 10,
  });

  // assert
  expect(screen.getByLabelText('Date')).toHaveValue('19.10.2026');
  expect(screen.getByLabelText('In USD')).toHaveValue('42.80');
});

test('leaves out the base currency amount typed for a date once the date is one with a rate', async () => {
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
      mode={{
        kind: 'create',
        typeChoice: { transactionTypes, onTypeChange: vi.fn() },
        presetAccountId: euroCard.id,
        renderMoneyAccountForm: () => null,
      }}
      transactionType="ADJUSTMENT"
      moneyAccounts={[ratedEuroCard]}
      baseCurrency="USD"
      relatedQueryKeys={[]}
      onClose={onClose}
    />,
  );
  await user.type(screen.getByLabelText('Amount'), '100');
  await user.type(screen.getByLabelText('Date'), '05102026', {
    initialSelectionStart: 0,
    initialSelectionEnd: 10,
  });
  await user.type(await screen.findByLabelText('In USD'), '54.30');
  await user.type(screen.getByLabelText('Date'), '06102026', {
    initialSelectionStart: 0,
    initialSelectionEnd: 10,
  });
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
    amount: '100.00',
    base_currency_amount: null,
  });
});

test('shows the base currency amount right under the amount', async () => {
  // act
  render(
    <TransactionForm
      mode={{
        kind: 'create',
        typeChoice: { transactionTypes, onTypeChange: vi.fn() },
        presetAccountId: euroCard.id,
        renderMoneyAccountForm: () => null,
      }}
      transactionType="ADJUSTMENT"
      moneyAccounts={[euroCard]}
      baseCurrency="USD"
      relatedQueryKeys={[]}
      onClose={vi.fn()}
    />,
  );

  // assert
  const baseCurrencyAmount = await screen.findByLabelText('In USD');
  expect(
    screen.getByLabelText('Amount').compareDocumentPosition(baseCurrencyAmount) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(
    baseCurrencyAmount.compareDocumentPosition(screen.getByRole('button', { name: /^Account/ })) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});

test('starts the edit form from the adjustment with its account fixed', () => {
  // act
  render(
    <TransactionForm
      mode={{ kind: 'edit', transaction: walletAdjustment }}
      transactionType="ADJUSTMENT"
      moneyAccounts={[wallet, euroCard]}
      baseCurrency="USD"
      relatedQueryKeys={[]}
      onClose={vi.fn()}
    />,
  );

  // assert
  expect(screen.getByRole('heading', { name: 'Edit adjustment' })).toBeInTheDocument();
  expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Amount')).toHaveValue('-32.50');
  expect(screen.getByLabelText('Date')).toHaveValue('18.10.2026');
  expect(screen.getByLabelText('Comment')).toHaveValue('Cash count');
  expect(screen.getByText('Wallet')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^Account/ })).not.toBeInTheDocument();
});

test('sends the update of the edited adjustment and closes', async () => {
  // arrange
  let requestBody: unknown = null;
  let requestPath = '';
  server.use(
    http.put(
      'http://localhost/api/accounting/accounts/:accountId/adjustment/:transactionId',
      async ({ request }) => {
        requestPath = new URL(request.url).pathname;
        requestBody = await request.json();
        return HttpResponse.json(walletAdjustment);
      },
    ),
  );
  const onClose = vi.fn<() => void>();
  const user = userEvent.setup();
  render(
    <TransactionForm
      mode={{ kind: 'edit', transaction: walletAdjustment }}
      transactionType="ADJUSTMENT"
      moneyAccounts={[wallet, euroCard]}
      baseCurrency="USD"
      relatedQueryKeys={[]}
      onClose={onClose}
    />,
  );
  await user.type(screen.getByLabelText('Amount'), '-40', {
    initialSelectionStart: 0,
    initialSelectionEnd: 6,
  });

  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  });
  // act
  await user.click(screen.getByRole('button', { name: 'Save changes' }));

  // assert
  await waitFor(() => {
    expect(onClose).toHaveBeenCalled();
  });
  expect(requestPath).toBe(
    `/api/accounting/accounts/${wallet.id}/adjustment/${walletAdjustment.id}`,
  );
  expect(requestBody).toEqual({
    transaction_date: '2026-10-18',
    comment: 'Cash count',
    amount: '-40.00',
    base_currency_amount: null,
  });
});

test.each([
  { typed: '-32.5', hint: 'Now $412.50' },
  { typed: '-40', hint: 'Now $412.50 → $405.00' },
])('shows $hint for the edited adjustment of -32.50 with $typed typed', async ({ typed, hint }) => {
  // arrange
  const user = userEvent.setup();
  render(
    <TransactionForm
      mode={{ kind: 'edit', transaction: walletAdjustment }}
      transactionType="ADJUSTMENT"
      moneyAccounts={[wallet]}
      baseCurrency="USD"
      relatedQueryKeys={[]}
      onClose={vi.fn()}
    />,
  );

  // act
  await user.type(screen.getByLabelText('Amount'), typed, {
    initialSelectionStart: 0,
    initialSelectionEnd: 6,
  });

  // assert
  expect(screen.getByLabelText('Amount')).toHaveAccessibleDescription(hint);
});

test('reads the account on the date without the edited adjustment and starts from its base currency amount', async () => {
  // arrange
  let excludedTransactionId: string | null = null;
  server.use(
    http.get(`http://localhost/api/accounting/accounts/${euroCard.id}`, ({ request }) => {
      excludedTransactionId = new URL(request.url).searchParams.get('excluded_transaction_id');
      return HttpResponse.json(euroCard);
    }),
  );

  // act
  render(
    <TransactionForm
      mode={{ kind: 'edit', transaction: euroCardAdjustment }}
      transactionType="ADJUSTMENT"
      moneyAccounts={[ratedEuroCard]}
      baseCurrency="USD"
      relatedQueryKeys={[]}
      onClose={vi.fn()}
    />,
  );

  // assert
  expect(await screen.findByLabelText('In USD')).toHaveValue('35.20');
  expect(excludedTransactionId).toBe(walletAdjustment.id);
});

test('keeps Save changes disabled until the account on the date of the edited adjustment has loaded', async () => {
  // arrange
  server.use(
    http.get(`http://localhost/api/accounting/accounts/${wallet.id}`, async () => {
      await delay(300);
      return HttpResponse.json(wallet);
    }),
  );

  // act
  render(
    <TransactionForm
      mode={{ kind: 'edit', transaction: walletAdjustment }}
      transactionType="ADJUSTMENT"
      moneyAccounts={[wallet]}
      baseCurrency="USD"
      relatedQueryKeys={[]}
      onClose={vi.fn()}
    />,
  );

  // assert
  expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  });
});

test('asks for the base currency amount afresh when the edited adjustment moves to a date without a rate', async () => {
  // arrange
  // the account has a rate from 06.10.2026 on, and none up to 05.10.2026
  server.use(
    http.get(`http://localhost/api/accounting/accounts/${euroCard.id}`, ({ request }) => {
      const date = new URL(request.url).searchParams.get('date') ?? '';
      return HttpResponse.json(date >= '2026-10-06' ? ratedEuroCard : euroCard);
    }),
  );
  const user = userEvent.setup();
  render(
    <TransactionForm
      mode={{ kind: 'edit', transaction: euroCardAdjustment }}
      transactionType="ADJUSTMENT"
      moneyAccounts={[ratedEuroCard]}
      baseCurrency="USD"
      relatedQueryKeys={[]}
      onClose={vi.fn()}
    />,
  );
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  });

  // act
  await user.type(screen.getByLabelText('Date'), '05102026', {
    initialSelectionStart: 0,
    initialSelectionEnd: 10,
  });

  // assert
  expect(await screen.findByLabelText('In USD')).toHaveValue('');
});
