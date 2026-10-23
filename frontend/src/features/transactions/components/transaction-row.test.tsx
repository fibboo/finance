import { screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

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
  source_amount: '42.80',
  source_currency: 'USD',
  destination_amount: '42.80',
  destination_currency: 'USD',
  base_currency_amount: '42.80',
  transaction_type: 'EXPENSE',
  status: 'ACTIVE',
  created_at: '2026-10-20T09:00:00Z',
  updated_at: '2026-10-20T09:00:00Z',
} satisfies components['schemas']['Transaction'];

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

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 20, 12));
});

afterEach(() => {
  vi.useRealTimers();
});

test.each([
  {
    kind: 'an expense',
    row: { ...transaction, from_account: wallet, category },
    texts: ['Groceries', 'Wallet', 'Today', '-$42.80'],
  },
  {
    kind: 'an income',
    row: {
      ...transaction,
      transaction_type: 'INCOME',
      transaction_date: '2026-10-19',
      destination_amount: '2100.00',
      destination_currency: 'EUR',
      to_account: wallet,
      income_source: incomeSource,
    },
    texts: ['Salary', 'Wallet', 'Yesterday', '+€2,100.00'],
  },
  {
    kind: 'a transfer',
    row: {
      ...transaction,
      transaction_type: 'TRANSFER',
      transaction_date: '2026-10-16',
      source_amount: '300.00',
      source_currency: 'EUR',
      from_account: wallet,
      to_account: savings,
    },
    texts: ['Transfer to Savings', 'Wallet → Savings', 'Oct 16', '€300.00'],
  },
  {
    kind: 'a decreasing adjustment',
    row: {
      ...transaction,
      transaction_type: 'ADJUSTMENT',
      transaction_date: '2025-12-31',
      source_amount: '12.00',
      from_account: savings,
    },
    texts: ['Balance adjustment', 'Savings', 'Dec 31, 2025', '-$12.00'],
  },
] satisfies { kind: string; row: components['schemas']['Transaction']; texts: string[] }[])(
  'describes $kind',
  async ({ row, texts }) => {
    // act
    render(<TransactionRow transaction={row} />);

    // assert
    for (const text of texts) {
      expect(await screen.findByText(text)).toBeInTheDocument();
    }
  },
);
