import { screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import type { components } from '@/lib/api-schema';
import { render } from '@/test/render';

import { TransactionRow } from './transaction-row';

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

const savings = {
  ...wallet,
  name: 'Savings',
  id: '7f0c2f4e-8c1a-4b9e-9d1f-0e6a3c2b1a04',
  color: '#2E8C7A',
} satisfies components['schemas']['Account'];

const transaction = {
  id: '5a1d9c3e-2b4f-4e6a-8c7d-9e0f1a2b3c4d',
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

const category = {
  ...wallet,
  name: 'Groceries',
  id: '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f',
  kind: 'EXPENSE',
  balance: '0',
  currency: null,
  category_type: 'VARIABLE',
  base_currency_rate: '0',
  base_currency_balance: '0.00',
} satisfies components['schemas']['Account'];

const equity = {
  ...wallet,
  name: 'Adjustments',
  id: '4d5e6f7a-8b9c-4d0e-9f1a-2b3c4d5e6f7a',
  kind: 'EQUITY',
  balance: '0',
  currency: null,
  base_currency_rate: '0',
  base_currency_balance: '0.00',
} satisfies components['schemas']['Account'];

const incomeSource = {
  ...wallet,
  name: 'Salary',
  id: '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f',
  kind: 'INCOME',
  balance: '0',
  currency: null,
  base_currency_rate: '0',
  base_currency_balance: '0.00',
} satisfies components['schemas']['Account'];

test.each([
  {
    kind: 'an expense',
    row: {
      ...transaction,
      postings: [
        { ...posting, amount: '-42.80', base_amount: '-42.80', account: wallet },
        { ...posting, amount: '42.80', base_amount: '42.80', account: category },
      ],
    },
    cells: ['Groceries', 'Wallet', '-$42.80', ''],
  },
  {
    kind: 'an expense not valued yet',
    row: {
      ...transaction,
      base_currency_amount: null,
      postings: [
        { ...posting, amount: '-42.80', currency: 'EUR', base_amount: null, account: wallet },
        { ...posting, amount: '42.80', currency: 'EUR', base_amount: null, account: category },
      ],
    },
    cells: ['Groceries', 'Wallet', '—not valued yet', '-€42.80'],
  },
  {
    kind: 'an income',
    row: {
      ...transaction,
      transaction_type: 'INCOME',
      transaction_date: '2026-10-19',
      income_period: '2026-10-01',
      postings: [
        {
          ...posting,
          amount: '-2100.00',
          currency: 'EUR',
          base_amount: '-2291.30',
          account: incomeSource,
        },
        { ...posting, amount: '2100.00', currency: 'EUR', base_amount: '2291.30', account: wallet },
      ],
    },
    cells: ['Salary', 'Wallet', '+$2,291.30', '+€2,100.00', '0.9165'],
  },
  {
    kind: 'a transfer',
    row: {
      ...transaction,
      transaction_type: 'TRANSFER',
      transaction_date: '2026-10-16',
      postings: [
        { ...posting, amount: '-300.00', currency: 'EUR', base_amount: '-327.40', account: wallet },
        { ...posting, amount: '300.00', currency: 'EUR', base_amount: '327.40', account: savings },
      ],
    },
    cells: ['Transfer to Savings', 'Wallet → Savings', '$327.40', '€300.00', '0.9163'],
  },
  {
    kind: 'a transfer not valued yet',
    row: {
      ...transaction,
      transaction_type: 'TRANSFER',
      base_currency_amount: null,
      postings: [
        { ...posting, amount: '-300.00', currency: 'EUR', base_amount: null, account: wallet },
        { ...posting, amount: '300.00', currency: 'EUR', base_amount: null, account: savings },
      ],
    },
    cells: ['Transfer to Savings', 'Wallet → Savings', '—not valued yet', '€300.00'],
  },
  {
    kind: 'a decreasing adjustment',
    row: {
      ...transaction,
      transaction_type: 'ADJUSTMENT',
      transaction_date: '2025-12-31',
      postings: [
        { ...posting, amount: '-12.00', base_amount: '-12.00', account: savings },
        { ...posting, amount: '12.00', base_amount: '12.00', account: equity },
      ],
    },
    cells: ['Balance adjustment', 'Savings', '-$12.00', ''],
  },
  {
    kind: 'an increasing adjustment',
    row: {
      ...transaction,
      transaction_type: 'ADJUSTMENT',
      postings: [
        { ...posting, amount: '-25.00', base_amount: '-25.00', account: equity },
        { ...posting, amount: '25.00', base_amount: '25.00', account: savings },
      ],
    },
    cells: ['Balance adjustment', 'Savings', '+$25.00', ''],
  },
] satisfies {
  kind: string;
  row: components['schemas']['Transaction'];
  cells: string[];
}[])('describes $kind', async ({ row, cells }) => {
  // act
  render(<TransactionRow transaction={row} baseCurrency="USD" />);

  // assert
  // the title, the accounts, the amount and its base-currency value, column by column
  expect(await screen.findByRole('listitem')).toHaveTextContent(cells.join(''));
});
