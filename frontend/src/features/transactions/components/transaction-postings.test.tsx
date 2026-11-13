import { screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import type { components } from '@/lib/api-schema';
import { render } from '@/test/render';

import { TransactionPostings } from './transaction-postings';

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

const accountKinds = [
  { key: 'ASSET', label: 'Asset' },
  { key: 'EQUITY', label: 'Equity' },
  { key: 'EXPENSE', label: 'Expense' },
] satisfies components['schemas']['DictionaryItem'][];

test.each([
  {
    kind: 'links an active money account to the address the route gives',
    account: wallet,
    href: '/accounts?account=7f0c2f4e-8c1a-4b9e-9d1f-0e6a3c2b1a03',
    text: 'WalletAsset · USD',
  },
  {
    kind: 'shows a deleted money account without a link',
    account: { ...wallet, status: 'DELETED' },
    href: null,
    text: 'Wallet, deletedAsset · USD',
  },
  {
    kind: 'links a category to the address the route gives',
    account: category,
    href: '/accounts?account=1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f',
    text: 'GroceriesExpense',
  },
  {
    kind: 'links a deleted category, struck through',
    account: { ...category, status: 'DELETED' },
    href: '/accounts?account=1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f',
    text: 'Groceries, deletedExpense',
  },
  {
    kind: 'shows the equity account without a link',
    account: { ...category, name: 'Adjustments', kind: 'EQUITY', category_type: null },
    href: null,
    text: 'AdjustmentsEquity',
  },
] satisfies {
  kind: string;
  account: components['schemas']['Account'];
  href: string | null;
  text: string;
}[])('$kind', async ({ account, href, text }) => {
  // act
  render(
    <TransactionPostings
      postings={[
        {
          id: '3e4f5a6b-7c8d-4e9f-8a0b-1c2d3e4f5a6b',
          amount: '-42.80',
          currency: 'USD',
          base_amount: '-42.80',
          account,
        },
      ]}
      baseCurrency="USD"
      accountKinds={accountKinds}
      readAccountLink={(account) => ({ pathname: '/accounts', search: `account=${account.id}` })}
    />,
  );

  // assert
  expect(await screen.findByRole('listitem')).toHaveTextContent(`${text}-$42.80`);
  expect(screen.queryByRole('link')?.getAttribute('href') ?? null).toBe(href);
});
