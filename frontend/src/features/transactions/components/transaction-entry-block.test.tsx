import { screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import type { AccountOptionChoices } from '@/lib/account-option-metadata';
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
  classification_id: '4e5f6a7b-8c9d-4e0f-9a1b-2c3d4e5f6a7b',
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
  classification_id: '6a7b8c9d-0e1f-4a2b-9c3d-4e5f6a7b8c9d',
  base_currency_rate: '0',
  base_currency_balance: '0.00',
} satisfies components['schemas']['Account'];

const incomeSource = {
  ...category,
  name: 'Salary',
  id: '2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f6a',
  kind: 'INCOME',
  category_type: null,
  classification_id: null,
} satisfies components['schemas']['Account'];

const accountOptionChoices = {
  moneyAccountTypes: [
    {
      id: '4e5f6a7b-8c9d-4e0f-9a1b-2c3d4e5f6a7b',
      name: 'Spending',
      kind: 'MONEY_ACCOUNT',
      is_default: true,
    },
    {
      id: '5f6a7b8c-9d0e-4f1a-8b2c-3d4e5f6a7b8c',
      name: 'Reserve',
      kind: 'MONEY_ACCOUNT',
      is_default: false,
    },
  ],
  expenseCategoryTypes: [
    {
      id: '6a7b8c9d-0e1f-4a2b-9c3d-4e5f6a7b8c9d',
      name: 'Bills',
      kind: 'EXPENSE_CATEGORY',
      is_default: true,
    },
    {
      id: '7b8c9d0e-1f2a-4b3c-8d4e-5f6a7b8c9d0e',
      name: 'Leisure',
      kind: 'EXPENSE_CATEGORY',
      is_default: false,
    },
  ],
  categoryPurposes: [{ key: 'PERSONAL', label: 'Personal' }],
} satisfies AccountOptionChoices;

test.each([
  {
    kind: 'shows a money account with its balance and a link',
    account: wallet,
    pageEntryId: null,
    href: `/accounts?account=${wallet.id}`,
    text: 'FromWWalletSpending · EURBalance €4,120.00-€900.00≈ -$1,053.00',
  },
  {
    kind: 'shows a deleted money account struck through, without a balance or a link',
    account: { ...wallet, status: 'DELETED' },
    pageEntryId: null,
    href: null,
    text: 'FromWWallet, deletedSpending · EUR-€900.00≈ -$1,053.00',
  },
  {
    kind: 'shows a category with its type, its purpose and a link',
    account: category,
    pageEntryId: null,
    href: `/accounts?account=${category.id}`,
    text: 'FromRRentBills · Personal-€900.00≈ -$1,053.00',
  },
  {
    kind: 'shows the category of the page as plain text',
    account: category,
    pageEntryId: category.id,
    href: null,
    text: 'FromRRentBills · Personal-€900.00≈ -$1,053.00',
  },
  {
    kind: 'shows a deleted category struck through, without a link',
    account: { ...category, status: 'DELETED' },
    pageEntryId: null,
    href: null,
    text: 'FromRRent, deletedBills · Personal-€900.00≈ -$1,053.00',
  },
  {
    kind: 'shows an income source as such',
    account: incomeSource,
    pageEntryId: null,
    href: `/accounts?account=${incomeSource.id}`,
    text: 'FromSSalaryIncome source-€900.00≈ -$1,053.00',
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
      accountOptionChoices={accountOptionChoices}
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
      accountOptionChoices={accountOptionChoices}
      readAccountLink={() => undefined}
    />,
  );

  // assert
  expect(await screen.findByRole('region', { name: 'To' })).toHaveTextContent(
    'ToWWalletSpending · USDBalance $1,204.50+$62.39',
  );
});
