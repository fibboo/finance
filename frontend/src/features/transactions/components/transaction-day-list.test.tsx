import { act, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import type { components } from '@/lib/api-schema';
import { render } from '@/test/render';

import { TransactionDayList } from './transaction-day-list';

const wallet = {
  name: 'Wallet',
  id: '7f0c2f4e-8c1a-4b9e-9d1f-0e6a3c2b1a03',
  user_id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
  kind: 'ASSET',
  balance: '412.50',
  currency: 'USD',
  color: null,
  category_type: null,
  base_currency_rate: '1',
  status: 'ACTIVE',
  base_currency_balance: '412.50',
} satisfies components['schemas']['Account'];

const mainCard = {
  ...wallet,
  name: 'Main card',
  id: '7f0c2f4e-8c1a-4b9e-9d1f-0e6a3c2b1a05',
  currency: 'EUR',
} satisfies components['schemas']['Account'];

const savings = {
  ...mainCard,
  name: 'Savings',
  id: '7f0c2f4e-8c1a-4b9e-9d1f-0e6a3c2b1a04',
} satisfies components['schemas']['Account'];

const category = {
  ...wallet,
  name: 'Groceries',
  id: '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f',
  kind: 'EXPENSE',
  currency: null,
  category_type: 'VARIABLE',
} satisfies components['schemas']['Account'];

const incomeSource = {
  ...wallet,
  name: 'Salary',
  id: '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f',
  kind: 'INCOME',
  currency: null,
} satisfies components['schemas']['Account'];

const equity = {
  ...wallet,
  name: 'Adjustments',
  id: '4d5e6f7a-8b9c-4d0e-9f1a-2b3c4d5e6f7a',
  kind: 'EQUITY',
  currency: null,
} satisfies components['schemas']['Account'];

const transaction = {
  id: '5a1d9c3e-2b4f-4e6a-8c7d-9e0f1a2b3c40',
  user_id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
  transaction_date: '2026-10-20',
  comment: null,
  base_currency_amount: '42.80',
  location: null,
  income_period: null,
  transaction_type: 'EXPENSE',
  status: 'ACTIVE',
  created_at: '2026-10-20T09:00:00Z',
  updated_at: '2026-10-20T09:00:00Z',
  postings: [],
} satisfies components['schemas']['Transaction'];

const posting = {
  id: '3e4f5a6b-7c8d-4e9f-8a0b-1c2d3e4f5a6b',
  amount: '0',
  currency: 'USD',
  base_amount: '0',
  account: wallet,
} satisfies components['schemas']['Posting'];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 20, 12));
});

afterEach(() => {
  vi.useRealTimers();
});

test('groups the transactions by day with each day total in the base currency', async () => {
  // arrange
  const transactions = [
    {
      ...transaction,
      postings: [
        { ...posting, amount: '-42.80', base_amount: '-42.80', account: wallet },
        { ...posting, amount: '42.80', base_amount: '42.80', account: category },
      ],
    },
    {
      ...transaction,
      id: '5a1d9c3e-2b4f-4e6a-8c7d-9e0f1a2b3c41',
      postings: [
        { ...posting, amount: '-4.50', base_amount: '-4.50', account: wallet },
        { ...posting, amount: '4.50', base_amount: '4.50', account: category },
      ],
    },
    // an expense not valued yet adds nothing to its day total
    {
      ...transaction,
      id: '5a1d9c3e-2b4f-4e6a-8c7d-9e0f1a2b3c47',
      base_currency_amount: null,
      postings: [
        { ...posting, amount: '-20.00', currency: 'EUR', base_amount: null, account: mainCard },
        { ...posting, amount: '20.00', currency: 'EUR', base_amount: null, account: category },
      ],
    },
    // the transfer of yesterday does not count toward its day total
    {
      ...transaction,
      id: '5a1d9c3e-2b4f-4e6a-8c7d-9e0f1a2b3c42',
      transaction_date: '2026-10-19',
      transaction_type: 'INCOME',
      income_period: '2026-10-01',
      postings: [
        {
          ...posting,
          amount: '-2100.00',
          currency: 'EUR',
          base_amount: '-2291.30',
          account: incomeSource,
        },
        {
          ...posting,
          amount: '2100.00',
          currency: 'EUR',
          base_amount: '2291.30',
          account: mainCard,
        },
      ],
    },
    {
      ...transaction,
      id: '5a1d9c3e-2b4f-4e6a-8c7d-9e0f1a2b3c43',
      transaction_date: '2026-10-19',
      transaction_type: 'TRANSFER',
      postings: [
        {
          ...posting,
          amount: '-300.00',
          currency: 'EUR',
          base_amount: '-327.40',
          account: mainCard,
        },
        { ...posting, amount: '300.00', currency: 'EUR', base_amount: '327.40', account: savings },
      ],
    },
    // a day of transfers only has no total
    {
      ...transaction,
      id: '5a1d9c3e-2b4f-4e6a-8c7d-9e0f1a2b3c46',
      transaction_date: '2026-10-18',
      transaction_type: 'TRANSFER',
      postings: [
        { ...posting, amount: '-50.00', base_amount: '-50.00', account: wallet },
        { ...posting, amount: '50.00', base_amount: '50.00', account: savings },
      ],
    },
    {
      ...transaction,
      id: '5a1d9c3e-2b4f-4e6a-8c7d-9e0f1a2b3c44',
      transaction_date: '2026-10-15',
      transaction_type: 'ADJUSTMENT',
      postings: [
        { ...posting, amount: '-25.00', base_amount: '-25.00', account: equity },
        { ...posting, amount: '25.00', base_amount: '25.00', account: wallet },
      ],
    },
    {
      ...transaction,
      id: '5a1d9c3e-2b4f-4e6a-8c7d-9e0f1a2b3c45',
      transaction_date: '2025-12-31',
      transaction_type: 'ADJUSTMENT',
      postings: [
        { ...posting, amount: '-12.00', base_amount: '-12.00', account: wallet },
        { ...posting, amount: '12.00', base_amount: '12.00', account: equity },
      ],
    },
  ] satisfies components['schemas']['Transaction'][];

  // act
  render(<TransactionDayList transactions={transactions} baseCurrency="USD" />);

  // assert
  const headings = await screen.findAllByRole('heading');
  expect(headings.map((heading) => heading.textContent)).toEqual([
    'Today',
    'Yesterday',
    'Sun, Oct 18',
    'Thu, Oct 15',
    'Wed, Dec 31, 2025',
  ]);
  expect(
    screen.getAllByRole('list').map((list) => within(list).getAllByRole('listitem').length),
  ).toEqual([3, 2, 1, 1, 1]);
  expect(screen.queryByText('$0.00')).not.toBeInTheDocument();
  expect(screen.getByText('-$47.30')).toBeInTheDocument();
  expect(screen.getAllByText('+$2,291.30')).toHaveLength(2);
  expect(screen.getAllByText('+$25.00')).toHaveLength(2);
  expect(screen.getAllByText('-$12.00')).toHaveLength(2);
});

test('names the day again after midnight', () => {
  // arrange
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  vi.setSystemTime(new Date(2026, 9, 20, 23, 59));
  const transactions = [
    {
      ...transaction,
      postings: [
        { ...posting, amount: '-42.80', base_amount: '-42.80', account: wallet },
        { ...posting, amount: '42.80', base_amount: '42.80', account: category },
      ],
    },
  ] satisfies components['schemas']['Transaction'][];
  render(<TransactionDayList transactions={transactions} baseCurrency="USD" />);
  expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument();

  // act
  act(() => {
    vi.advanceTimersByTime(60_000);
  });

  // assert
  expect(screen.getByRole('heading', { name: 'Yesterday' })).toBeInTheDocument();
});
