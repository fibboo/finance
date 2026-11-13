import { screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import type { components } from '@/lib/api-schema';
import { render } from '@/test/render';

import { TransactionEntryBlock } from './transaction-entry-block';

const wallet = {
  name: 'Wallet',
  id: '7f0c2f4e-8c1a-4b9e-9d1f-0e6a3c2b1a03',
  user_id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
  kind: 'ASSET',
  balance: '4120.00',
  currency: 'EUR',
  color: null,
  category_type: null,
  base_currency_rate: '0.8547',
  status: 'ACTIVE',
  base_currency_balance: '4820.40',
} satisfies components['schemas']['Account'];

const category = {
  ...wallet,
  name: 'Rent',
  id: '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f',
  kind: 'EXPENSE',
  balance: '0',
  currency: null,
  category_type: 'FIXED',
  base_currency_rate: '0',
  base_currency_balance: '0.00',
} satisfies components['schemas']['Account'];

const incomeSource = {
  ...category,
  name: 'Salary',
  id: '2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f6a',
  kind: 'INCOME',
  category_type: null,
} satisfies components['schemas']['Account'];

const accountKinds = [
  { key: 'ASSET', label: 'Asset' },
  { key: 'EXPENSE', label: 'Expense' },
  { key: 'INCOME', label: 'Income' },
] satisfies components['schemas']['DictionaryItem'][];

const categoryTypes = [
  { key: 'FIXED', label: 'Fixed' },
] satisfies components['schemas']['DictionaryItem'][];

test.each([
  {
    kind: 'shows a money account with its balance and a link',
    account: wallet,
    pageEntryId: null,
    href: `/accounts?account=${wallet.id}`,
    text: 'FromWWalletAsset · EURBalance €4,120.00-€900.00≈ -$1,053.00',
  },
  {
    kind: 'shows a deleted money account struck through, without a balance or a link',
    account: { ...wallet, status: 'DELETED' },
    pageEntryId: null,
    href: null,
    text: 'FromWWallet, deletedAsset · EUR-€900.00≈ -$1,053.00',
  },
  {
    kind: 'shows a category with its type and a link',
    account: category,
    pageEntryId: null,
    href: `/accounts?account=${category.id}`,
    text: 'FromRRentExpense · Fixed-€900.00≈ -$1,053.00',
  },
  {
    kind: 'shows the category of the page as plain text',
    account: category,
    pageEntryId: category.id,
    href: null,
    text: 'FromRRentExpense · Fixed-€900.00≈ -$1,053.00',
  },
  {
    kind: 'shows a deleted category struck through, without a link',
    account: { ...category, status: 'DELETED' },
    pageEntryId: null,
    href: null,
    text: 'FromRRent, deletedExpense · Fixed-€900.00≈ -$1,053.00',
  },
  {
    kind: 'shows an income source with its kind',
    account: incomeSource,
    pageEntryId: null,
    href: `/accounts?account=${incomeSource.id}`,
    text: 'FromSSalaryIncome-€900.00≈ -$1,053.00',
  },
] satisfies {
  kind: string;
  account: components['schemas']['Account'];
  pageEntryId: string | null;
  href: string | null;
  text: string;
}[])('$kind', async ({ account, pageEntryId, href, text }) => {
  // act
  render(
    <TransactionEntryBlock
      entry={{
        role: 'From',
        posting: {
          id: '3e4f5a6b-7c8d-4e9f-8a0b-1c2d3e4f5a6b',
          amount: '-900.00',
          currency: 'EUR',
          base_amount: '-1053.00',
          account,
        },
      }}
      baseCurrency="USD"
      accountKinds={accountKinds}
      categoryTypes={categoryTypes}
      readAccountLink={(linkedAccount) =>
        linkedAccount.id === pageEntryId
          ? undefined
          : { pathname: '/accounts', search: `account=${linkedAccount.id}` }
      }
    />,
  );

  // assert
  expect(await screen.findByRole('region', { name: 'From' })).toHaveTextContent(text);
  expect(screen.queryByRole('link')?.getAttribute('href') ?? null).toBe(href);
});

test('leaves out the estimate of an amount in the base currency', async () => {
  // act
  render(
    <TransactionEntryBlock
      entry={{
        role: 'To',
        posting: {
          id: '3e4f5a6b-7c8d-4e9f-8a0b-1c2d3e4f5a6b',
          amount: '62.39',
          currency: 'USD',
          base_amount: '62.39',
          account: { ...wallet, currency: 'USD', balance: '1204.50' },
        },
      }}
      baseCurrency="USD"
      accountKinds={accountKinds}
      categoryTypes={categoryTypes}
      readAccountLink={() => undefined}
    />,
  );

  // assert
  expect(await screen.findByRole('region', { name: 'To' })).toHaveTextContent(
    'ToWWalletAsset · USDBalance $1,204.50+$62.39',
  );
});
