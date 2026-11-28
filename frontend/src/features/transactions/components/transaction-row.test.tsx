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

const transactionTypes = [
  { key: 'TRANSFER', label: 'Transfer' },
  { key: 'ADJUSTMENT', label: 'Adjustment' },
] satisfies components['schemas']['DictionaryItem'][];

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
    cells: ['Groceries', '-$42.80', 'Wallet'],
  },
  {
    kind: 'an expense in a category used to earn income',
    row: {
      ...transaction,
      postings: [
        { ...posting, amount: '-42.80', base_amount: '-42.80', account: wallet },
        {
          ...posting,
          amount: '42.80',
          base_amount: '42.80',
          account: { ...category, name: 'Platform fees', category_purpose: 'INCOME_COST' },
        },
      ],
    },
    cells: ['Platform fees', '-$42.80', 'Wallet'],
    hasIncomeCostIcon: true,
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
    cells: ['Groceries', '-€42.80, not valued yet', 'Wallet'],
  },
  {
    kind: 'an expense not valued yet without a rate for its estimate',
    row: {
      ...transaction,
      base_currency_amount: null,
      estimated_base_currency_amount: null,
      postings: [
        {
          ...posting,
          amount: '-42.80',
          currency: 'EUR',
          base_amount: null,
          estimated_base_amount: null,
          account: wallet,
        },
        {
          ...posting,
          amount: '42.80',
          currency: 'EUR',
          base_amount: null,
          estimated_base_amount: null,
          account: category,
        },
      ],
    },
    cells: ['Groceries', '-€42.80, not valued yet', 'Wallet'],
  },
  {
    kind: 'an expense not valued yet by its estimate over its own amount',
    row: {
      ...transaction,
      base_currency_amount: null,
      estimated_base_currency_amount: '45.10',
      postings: [
        {
          ...posting,
          amount: '-42.80',
          currency: 'EUR',
          base_amount: null,
          estimated_base_amount: '-45.10',
          account: wallet,
        },
        {
          ...posting,
          amount: '42.80',
          currency: 'EUR',
          base_amount: null,
          estimated_base_amount: '45.10',
          account: category,
        },
      ],
    },
    cells: ['Groceries', '≈ -$45.10', 'Wallet · ≈ 0.9490', '-€42.80'],
  },
  {
    kind: 'an expense not valued yet by an estimate of zero',
    row: {
      ...transaction,
      base_currency_amount: null,
      estimated_base_currency_amount: '0.00',
      postings: [
        {
          ...posting,
          amount: '-0.01',
          currency: 'RSD',
          base_amount: null,
          estimated_base_amount: '0.00',
          account: wallet,
        },
        {
          ...posting,
          amount: '0.01',
          currency: 'RSD',
          base_amount: null,
          estimated_base_amount: '0.00',
          account: category,
        },
      ],
    },
    cells: ['Groceries', '≈ $0.00', 'Wallet', '-RSD 0.01'],
  },
  {
    kind: 'a valued expense by its base amount even next to an estimate',
    row: {
      ...transaction,
      estimated_base_currency_amount: '45.10',
      postings: [
        {
          ...posting,
          amount: '-42.80',
          currency: 'EUR',
          base_amount: '-46.00',
          estimated_base_amount: '-45.10',
          account: wallet,
        },
        {
          ...posting,
          amount: '42.80',
          currency: 'EUR',
          base_amount: '46.00',
          estimated_base_amount: '45.10',
          account: category,
        },
      ],
    },
    cells: ['Groceries', '-$46.00', 'Wallet · 0.9304', '-€42.80'],
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
    cells: ['Salary', '+$2,291.30', 'Wallet · 0.9165', '+€2,100.00'],
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
    cells: ['Wallet → Savings', '$327.40', '0.9163', '€300.00'],
  },
  {
    kind: 'a two-currency expense with a base-currency account and a comment',
    row: {
      ...transaction,
      comment: 'Flat white at Heathrow',
      postings: [
        { ...posting, amount: '-5.72', base_amount: '-5.72', account: wallet },
        { ...posting, amount: '4.50', currency: 'GBP', base_amount: '5.72', account: category },
      ],
    },
    cells: ['Groceries', '-$5.72', 'Wallet · 0.7867 · Flat white at Heathrow', '-£4.50'],
  },
  {
    kind: 'a transfer between two currencies other than the base currency',
    row: {
      ...transaction,
      transaction_type: 'TRANSFER',
      postings: [
        { ...posting, amount: '-100.00', currency: 'EUR', base_amount: '-109.16', account: wallet },
        { ...posting, amount: '87.90', currency: 'GBP', base_amount: '109.16', account: savings },
        { ...posting, amount: '0', currency: 'USD', base_amount: '1.00', account: equity },
      ],
    },
    cells: ['Wallet → Savings', '$109.16', '1.1377', '€100.00 → £87.90'],
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
    cells: ['Wallet → Savings', '€300.00, not valued yet'],
  },
  {
    kind: 'a transfer not valued yet by its estimate without a sign',
    row: {
      ...transaction,
      transaction_type: 'TRANSFER',
      base_currency_amount: null,
      postings: [
        {
          ...posting,
          amount: '-300.00',
          currency: 'EUR',
          base_amount: null,
          estimated_base_amount: '-327.00',
          account: wallet,
        },
        {
          ...posting,
          amount: '300.00',
          currency: 'EUR',
          base_amount: null,
          estimated_base_amount: '327.00',
          account: savings,
        },
      ],
    },
    cells: ['Wallet → Savings', '≈ $327.00', '≈ 0.9174', '€300.00'],
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
    cells: ['Adjustment', '-$12.00', 'Savings'],
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
    cells: ['Adjustment', '+$25.00', 'Savings'],
  },
  {
    kind: 'an expense of a deleted category from a deleted account',
    row: {
      ...transaction,
      postings: [
        {
          ...posting,
          amount: '-42.80',
          base_amount: '-42.80',
          account: { ...wallet, status: 'DELETED' },
        },
        {
          ...posting,
          amount: '42.80',
          base_amount: '42.80',
          account: { ...category, status: 'DELETED' },
        },
      ],
    },
    cells: ['Groceries, deleted', '-$42.80', 'Wallet, deleted'],
  },
  {
    kind: 'an income of a deleted source',
    row: {
      ...transaction,
      transaction_type: 'INCOME',
      postings: [
        {
          ...posting,
          amount: '-100.00',
          base_amount: '-100.00',
          account: { ...incomeSource, status: 'DELETED' },
        },
        { ...posting, amount: '100.00', base_amount: '100.00', account: wallet },
      ],
    },
    cells: ['Salary, deleted', '+$100.00', 'Wallet'],
  },
  {
    kind: 'a transfer from a deleted account',
    row: {
      ...transaction,
      transaction_type: 'TRANSFER',
      postings: [
        {
          ...posting,
          amount: '-300.00',
          base_amount: '-300.00',
          account: { ...wallet, status: 'DELETED' },
        },
        { ...posting, amount: '300.00', base_amount: '300.00', account: savings },
      ],
    },
    cells: ['Wallet, deleted → Savings', '$300.00'],
  },
  {
    kind: 'an adjustment of a deleted account',
    row: {
      ...transaction,
      transaction_type: 'ADJUSTMENT',
      postings: [
        { ...posting, amount: '-25.00', base_amount: '-25.00', account: equity },
        {
          ...posting,
          amount: '25.00',
          base_amount: '25.00',
          account: { ...savings, status: 'DELETED' },
        },
      ],
    },
    cells: ['Adjustment', '+$25.00', 'Savings, deleted'],
  },
] satisfies {
  kind: string;
  row: components['schemas']['Transaction'];
  cells: string[];
  hasIncomeCostIcon?: boolean;
}[])('describes $kind', async ({ row, cells, hasIncomeCostIcon = false }) => {
  // act
  render(
    <TransactionRow
      transaction={row}
      baseCurrency="USD"
      transactionTypes={transactionTypes}
      isTop={false}
      arrowKeySelection={{
        'data-arrow-key-list': 'transactions',
        'data-arrow-key-orientation': 'vertical',
      }}
    />,
  );

  // assert
  // the title, the base-currency amount, its account line and the account's own amount
  expect(await screen.findByRole('listitem')).toHaveTextContent(cells.join(''));
  const incomeCostIcon = screen.queryByRole('img', { name: 'Income cost' });
  if (hasIncomeCostIcon) {
    expect(incomeCostIcon).toBeVisible();
  } else {
    expect(incomeCostIcon).not.toBeInTheDocument();
  }
});

test.each([
  {
    kind: 'keeps the filters of the list in the link to its details',
    url: '/transactions?order=base_currency_amount%3Adesc',
    current: null,
  },
  {
    kind: 'marks the row whose details are open',
    url: '/transactions?order=base_currency_amount%3Adesc&transaction=5a1d9c3e-2b4f-4e6a-8c7d-9e0f1a2b3c4d',
    current: 'true',
  },
])('$kind', async ({ url, current }) => {
  // act
  render(
    <TransactionRow
      transaction={{
        ...transaction,
        postings: [
          { ...posting, amount: '-42.80', base_amount: '-42.80', account: wallet },
          { ...posting, amount: '42.80', base_amount: '42.80', account: category },
        ],
      }}
      baseCurrency="USD"
      transactionTypes={transactionTypes}
      isTop={false}
      arrowKeySelection={{
        'data-arrow-key-list': 'transactions',
        'data-arrow-key-orientation': 'vertical',
      }}
    />,
    { initialEntries: [url] },
  );

  // assert
  const link = await screen.findByRole('link', { name: 'Groceries' });
  expect(link).toHaveAttribute(
    'href',
    '/transactions?order=base_currency_amount%3Adesc&transaction=5a1d9c3e-2b4f-4e6a-8c7d-9e0f1a2b3c4d',
  );
  expect(link.getAttribute('aria-current')).toBe(current);
});

test('names the money account instead of the entry every row of the feed has', async () => {
  // act
  render(
    <TransactionRow
      transaction={{
        ...transaction,
        location: {
          id: '4a52f0e1-1d7b-4a52-9f3a-0b5c1f0e8d44',
          user_id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
          name: 'Spar',
          description: null,
          status: 'ACTIVE',
          created_at: '2026-10-01T09:00:00Z',
          updated_at: '2026-10-01T09:00:00Z',
        },
        postings: [
          { ...posting, amount: '-42.80', base_amount: '-42.80', account: wallet },
          { ...posting, amount: '42.80', base_amount: '42.80', account: category },
        ],
      }}
      baseCurrency="USD"
      transactionTypes={transactionTypes}
      isTop={false}
      arrowKeySelection={undefined}
      omittedAccountIds={[category.id]}
    />,
  );

  // assert
  expect(await screen.findByRole('listitem')).toHaveTextContent('WalletSpar-$42.80');
});

test.each([
  {
    kind: 'the category and location of an expense',
    row: {
      ...transaction,
      location: {
        id: '4a52f0e1-1d7b-4a52-9f3a-0b5c1f0e8d44',
        user_id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
        name: 'Spar',
        description: null,
        status: 'ACTIVE',
        created_at: '2026-10-01T09:00:00Z',
        updated_at: '2026-10-01T09:00:00Z',
      },
      postings: [
        { ...posting, amount: '-42.10', currency: 'EUR', base_amount: '-49.26', account: wallet },
        { ...posting, amount: '42.10', currency: 'EUR', base_amount: '49.26', account: category },
      ],
    },
    cells: ['Groceries', 'Spar', '-$49.26', '0.8546', '-€42.10'],
  },
  {
    kind: 'the other account of an outgoing transfer with the amount that left',
    row: {
      ...transaction,
      transaction_type: 'TRANSFER',
      postings: [
        { ...posting, amount: '-300.00', currency: 'EUR', base_amount: '-327.40', account: wallet },
        { ...posting, amount: '300.00', currency: 'EUR', base_amount: '327.40', account: savings },
      ],
    },
    cells: ['Wallet → Savings', '-$327.40', '0.9163', '-€300.00'],
  },
  {
    kind: 'the other account of an incoming transfer with the amount that came in',
    row: {
      ...transaction,
      transaction_type: 'TRANSFER',
      postings: [
        { ...posting, amount: '-300.00', base_amount: '-300.00', account: savings },
        { ...posting, amount: '280.00', currency: 'EUR', base_amount: '300.00', account: wallet },
      ],
    },
    cells: ['Savings → Wallet', '+$300.00', '0.9333', '+€280.00'],
  },
  {
    kind: 'the other account of an incoming transfer valued apart from its source by its own rate',
    row: {
      ...transaction,
      transaction_type: 'TRANSFER',
      postings: [
        { ...posting, amount: '-400.00', currency: 'RSD', base_amount: '-4.00', account: savings },
        { ...posting, amount: '400.00', currency: 'RSD', base_amount: '5.00', account: wallet },
        { ...posting, amount: '0', currency: 'USD', base_amount: '-1.00', account: equity },
      ],
    },
    cells: ['Savings → Wallet', '+$5.00', '80.0000', '+RSD 400.00'],
  },
  {
    kind: 'the other account of an incoming transfer not valued yet by its signed estimate',
    row: {
      ...transaction,
      transaction_type: 'TRANSFER',
      base_currency_amount: null,
      postings: [
        {
          ...posting,
          amount: '-300.00',
          currency: 'EUR',
          base_amount: null,
          estimated_base_amount: '-327.00',
          account: savings,
        },
        {
          ...posting,
          amount: '300.00',
          currency: 'EUR',
          base_amount: null,
          estimated_base_amount: '327.00',
          account: wallet,
        },
      ],
    },
    cells: ['Savings → Wallet', '≈ +$327.00', '≈ 0.9174', '+€300.00'],
  },
  {
    kind: 'only the type of an adjustment',
    row: {
      ...transaction,
      transaction_type: 'ADJUSTMENT',
      postings: [
        { ...posting, amount: '-25.00', base_amount: '-25.00', account: equity },
        { ...posting, amount: '25.00', base_amount: '25.00', account: wallet },
      ],
    },
    cells: ['Adjustment', '+$25.00'],
  },
] satisfies {
  kind: string;
  row: components['schemas']['Transaction'];
  cells: string[];
}[])(
  'leaves out the money account every row of the feed has and names $kind',
  async ({ row, cells }) => {
    // act
    render(
      <TransactionRow
        transaction={row}
        baseCurrency="USD"
        transactionTypes={transactionTypes}
        isTop={false}
        arrowKeySelection={undefined}
        omittedAccountIds={[wallet.id]}
      />,
    );

    // assert
    expect(await screen.findByRole('listitem')).toHaveTextContent(cells.join(''));
  },
);

const spar = {
  id: '4a52f0e1-1d7b-4a52-9f3a-0b5c1f0e8d44',
  user_id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
  name: 'Spar',
  description: null,
  status: 'ACTIVE',
  created_at: '2026-10-01T09:00:00Z',
  updated_at: '2026-10-01T09:00:00Z',
} satisfies components['schemas']['Location'];

test.each([
  {
    kind: 'shows the location once after the title',
    location: spar,
    omittedLocationIds: [],
    text: 'GroceriesSpar-$42.80Wallet · Weekly shopping',
    locationCount: 1,
  },
  {
    kind: 'shows no location and no separator for it when the transaction has none',
    location: null,
    omittedLocationIds: [],
    text: 'Groceries-$42.80Wallet · Weekly shopping',
    locationCount: 0,
  },
  {
    kind: 'leaves out the location every row of the feed has',
    location: spar,
    omittedLocationIds: [spar.id],
    text: 'Groceries-$42.80Wallet · Weekly shopping',
    locationCount: 0,
  },
] satisfies {
  kind: string;
  location: components['schemas']['Location'] | null;
  omittedLocationIds: string[];
  text: string;
  locationCount: number;
}[])('$kind', async ({ location, omittedLocationIds, text, locationCount }) => {
  // act
  render(
    <TransactionRow
      transaction={{
        ...transaction,
        comment: 'Weekly shopping',
        location,
        postings: [
          { ...posting, amount: '-42.80', base_amount: '-42.80', account: wallet },
          { ...posting, amount: '42.80', base_amount: '42.80', account: category },
        ],
      }}
      baseCurrency="USD"
      transactionTypes={transactionTypes}
      isTop={false}
      arrowKeySelection={undefined}
      omittedLocationIds={omittedLocationIds}
    />,
  );

  // assert
  expect(await screen.findByRole('listitem')).toHaveTextContent(text, {
    normalizeWhitespace: true,
  });
  expect(screen.queryAllByText('Spar')).toHaveLength(locationCount);
});
