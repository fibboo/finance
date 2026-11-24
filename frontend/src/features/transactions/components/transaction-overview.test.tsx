import { screen, within } from '@testing-library/react';
import { expect, test } from 'vitest';

import type { components } from '@/lib/api-schema';
import { render } from '@/test/render';

import { TransactionOverview } from './transaction-overview';

const source = {
  id: '7f0c2f4e-8c1a-4b9e-9d1f-0e6a3c2b1a03',
  user_id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
  name: 'Euro card',
  kind: 'ASSET',
  balance: '1200.00',
  currency: 'EUR',
  color: null,
  category_type: null,
  base_currency_rate: '0.9161',
  base_currency_balance: '1309.90',
  status: 'ACTIVE',
} satisfies components['schemas']['Account'];

const transfer = {
  id: '5a1d9c3e-2b4f-4e6a-8c7d-9e0f1a2b3c4d',
  user_id: source.user_id,
  transaction_type: 'TRANSFER',
  transaction_date: '2026-10-20',
  comment: null,
  location: null,
  income_period: null,
  base_currency_amount: null,
  status: 'ACTIVE',
  created_at: '2026-10-20T09:00:00Z',
  updated_at: '2026-10-20T09:00:00Z',
} satisfies Omit<components['schemas']['Transaction'], 'postings'>;

test.each([
  {
    name: 'a same-currency transfer with an estimated valuation',
    fromCurrency: 'EUR',
    toCurrency: 'EUR',
    fromAmount: '-100.00',
    toAmount: '100.00',
    fromBase: '-109.16',
    toBase: '109.16',
    isEstimated: true,
    equations: ['1 USD = 0.9161 EUR'],
    labels: ['Estimated valuation in USD'],
  },
  {
    name: 'a transfer between two foreign currencies',
    fromCurrency: 'EUR',
    toCurrency: 'GBP',
    fromAmount: '-100.00',
    toAmount: '87.90',
    fromBase: '-109.16',
    toBase: '109.16',
    isEstimated: false,
    equations: ['1 GBP = 1.1377 EUR', '1 USD = 0.9161 EUR'],
    labels: ['Transaction rate', 'Valuation in USD'],
  },
  {
    name: 'an estimate rounded to zero',
    fromCurrency: 'EUR',
    toCurrency: 'EUR',
    fromAmount: '-0.01',
    toAmount: '0.01',
    fromBase: '0.00',
    toBase: '0.00',
    isEstimated: true,
    equations: [],
    labels: [],
  },
  {
    name: 'a transfer in the base currency',
    fromCurrency: 'USD',
    toCurrency: 'USD',
    fromAmount: '-100.00',
    toAmount: '100.00',
    fromBase: '-100.00',
    toBase: '100.00',
    isEstimated: false,
    equations: [],
    labels: [],
  },
  {
    name: 'an expense with matching operation and valuation rates',
    transactionType: 'EXPENSE',
    fromCurrency: 'RSD',
    toCurrency: 'USD',
    fromAmount: '-1385.71',
    toAmount: '13.00',
    fromBase: '-13.00',
    toBase: '13.00',
    isEstimated: false,
    equations: ['1 USD = 106.5931 RSD'],
    labels: ['Transaction rate · Valuation in USD'],
  },
  {
    name: 'an expense with three currencies without a redundant counterparty valuation',
    transactionType: 'EXPENSE',
    fromCurrency: 'RSD',
    toCurrency: 'EUR',
    fromAmount: '-379.51',
    toAmount: '2.99',
    fromBase: '-3.79',
    toBase: '3.79',
    isEstimated: false,
    equations: ['1 EUR = 126.9264 RSD', '1 USD = 100.1346 RSD'],
    labels: ['Transaction rate', 'Valuation in USD'],
  },
  {
    name: 'a same-currency expense with one valuation',
    transactionType: 'EXPENSE',
    fromCurrency: 'RSD',
    toCurrency: 'RSD',
    fromAmount: '-400.00',
    toAmount: '400.00',
    fromBase: '-4.00',
    toBase: '4.00',
    isEstimated: false,
    equations: ['1 USD = 100.0000 RSD'],
    labels: ['Valuation in USD'],
  },
  {
    name: 'an income with one valuation',
    transactionType: 'INCOME',
    fromCurrency: 'RSD',
    toCurrency: 'RSD',
    fromAmount: '-400.00',
    toAmount: '400.00',
    fromBase: '-4.00',
    toBase: '4.00',
    isEstimated: false,
    equations: ['1 USD = 100.0000 RSD'],
    labels: ['Valuation in USD'],
  },
  {
    name: 'an adjustment with one valuation',
    transactionType: 'ADJUSTMENT',
    fromCurrency: 'RSD',
    toCurrency: 'RSD',
    fromAmount: '-400.00',
    toAmount: '400.00',
    fromBase: '-4.00',
    toBase: '4.00',
    isEstimated: false,
    equations: ['1 USD = 100.0000 RSD'],
    labels: ['Valuation in USD'],
  },
  {
    name: 'a foreign income valued from the receiving account',
    transactionType: 'INCOME',
    fromCurrency: 'RSD',
    toCurrency: 'EUR',
    fromAmount: '-420.00',
    toAmount: '3.50',
    fromBase: '-4.00',
    toBase: '4.00',
    isEstimated: false,
    equations: ['1 EUR = 120.0000 RSD', '1 USD = 0.8750 EUR'],
    labels: ['Transaction rate', 'Valuation in USD'],
  },
  {
    name: 'a header estimate when the posting has no valuation',
    fromCurrency: 'EUR',
    toCurrency: 'EUR',
    fromAmount: '-100.00',
    toAmount: '100.00',
    fromBase: null,
    toBase: null,
    isEstimated: true,
    headerEstimate: '109.16',
    equations: ['1 USD = 0.9161 EUR'],
    labels: ['Estimated valuation in USD'],
  },
  {
    name: 'differing valuations of a same-currency transfer',
    fromCurrency: 'RSD',
    toCurrency: 'RSD',
    fromAmount: '-400.00',
    toAmount: '400.00',
    fromBase: '-4.00',
    toBase: '5.00',
    isEstimated: false,
    equations: ['1 USD = 100.0000 RSD', '1 USD = 80.0000 RSD'],
    labels: ['Valuation in USD (From)', 'Valuation in USD (To)'],
    distinctEquivalent: '≈ +$5.00',
  },
  {
    name: 'differing valuations of a two-currency transfer',
    fromCurrency: 'EUR',
    toCurrency: 'RSD',
    fromAmount: '-100.00',
    toAmount: '12000.00',
    fromBase: '-110.00',
    toBase: '120.00',
    isEstimated: false,
    equations: ['1 EUR = 120.0000 RSD', '1 USD = 0.9091 EUR', '1 USD = 100.0000 RSD'],
    labels: ['Transaction rate', 'Valuation in USD (From)', 'Valuation in USD (To)'],
    distinctEquivalent: '≈ +$120.00',
  },
  {
    name: 'different ratios whose display values round to the same rate',
    fromCurrency: 'RSD',
    toCurrency: 'RSD',
    fromAmount: '-100.00001',
    toAmount: '100.00002',
    fromBase: '-1.00',
    toBase: '1.00',
    isEstimated: false,
    equations: ['1 USD = 100.0000 RSD', '1 USD = 100.0000 RSD'],
    labels: ['Valuation in USD (From)', 'Valuation in USD (To)'],
  },
  {
    name: 'a transaction without a valuation',
    fromCurrency: 'EUR',
    toCurrency: 'EUR',
    fromAmount: '-100.00',
    toAmount: '100.00',
    fromBase: null,
    toBase: null,
    isEstimated: false,
    equations: [],
    labels: [],
  },
  {
    name: 'an operation rate without a valuation',
    fromCurrency: 'EUR',
    toCurrency: 'GBP',
    fromAmount: '-100.00',
    toAmount: '87.90',
    fromBase: null,
    toBase: null,
    isEstimated: false,
    equations: ['1 GBP = 1.1377 EUR'],
    labels: ['Transaction rate'],
  },
  {
    name: 'zero amounts and denominators',
    fromCurrency: 'EUR',
    toCurrency: 'RSD',
    fromAmount: '0.00',
    toAmount: '0.00',
    fromBase: '0.00',
    toBase: '0.00',
    isEstimated: false,
    equations: [],
    labels: [],
  },
] satisfies readonly Readonly<{
  name: string;
  transactionType?: components['schemas']['TransactionType'];
  fromCurrency: string;
  toCurrency: string;
  fromAmount: string;
  toAmount: string;
  fromBase: string | null;
  toBase: string | null;
  isEstimated: boolean;
  equations: readonly string[];
  labels: readonly string[];
  distinctEquivalent?: string;
  headerEstimate?: string;
}>[])('shows explicit distinct rates for $name', (scenario) => {
  // arrange
  const transactionType = 'transactionType' in scenario ? scenario.transactionType : 'TRANSFER';
  const postings = [
    {
      id: '3e4f5a6b-7c8d-4e9f-8a0b-1c2d3e4f5a6a',
      account: {
        ...source,
        currency: scenario.fromCurrency,
        kind: transactionType === 'INCOME' ? 'INCOME' : 'ASSET',
      },
      currency: scenario.fromCurrency,
      amount: scenario.fromAmount,
      base_amount: scenario.isEstimated ? null : scenario.fromBase,
      estimated_base_amount: scenario.isEstimated ? scenario.fromBase : null,
    },
    {
      id: '3e4f5a6b-7c8d-4e9f-8a0b-1c2d3e4f5a6b',
      account: {
        ...source,
        id: '7f0c2f4e-8c1a-4b9e-9d1f-0e6a3c2b1a04',
        name: 'Destination',
        currency: scenario.toCurrency,
        kind:
          transactionType === 'EXPENSE'
            ? 'EXPENSE'
            : transactionType === 'ADJUSTMENT'
              ? 'EQUITY'
              : 'ASSET',
      },
      currency: scenario.toCurrency,
      amount: scenario.toAmount,
      base_amount: scenario.isEstimated ? null : scenario.toBase,
      estimated_base_amount: scenario.isEstimated ? scenario.toBase : null,
    },
  ] satisfies components['schemas']['Posting'][];

  // act
  render(
    <TransactionOverview
      transaction={{
        ...transfer,
        transaction_type: transactionType,
        postings,
        ...('headerEstimate' in scenario
          ? { estimated_base_currency_amount: scenario.headerEstimate }
          : {}),
      }}
      baseCurrency="USD"
      transactionTypes={[{ key: transactionType, label: transactionType }]}
      accountKinds={[
        { key: 'ASSET', label: 'Asset' },
        { key: 'INCOME', label: 'Income' },
        { key: 'EXPENSE', label: 'Expense' },
        { key: 'EQUITY', label: 'Equity' },
      ]}
      categoryTypes={[]}
      readAccountLink={() => undefined}
      readLocationLink={() => undefined}
      closeButton={null}
      editAction={null}
      deleteAction={null}
    />,
  );

  // assert
  expect(screen.getByRole('article')).not.toHaveTextContent(' · rate ');
  const rates = screen.queryByRole('region', { name: 'Exchange rates' });
  if (scenario.equations.length === 0) {
    expect(rates).not.toBeInTheDocument();
  } else {
    if (rates === null) {
      throw new Error('The transaction has no rates section.');
    }
    expect(
      within(rates)
        .getAllByRole('definition')
        .map((element) => element.textContent),
    ).toEqual(scenario.equations);
    expect(
      within(rates)
        .getAllByRole('term')
        .map((element) => element.textContent),
    ).toEqual(scenario.labels);
  }
  if ('distinctEquivalent' in scenario) {
    expect(
      within(screen.getByRole('region', { name: 'To' })).getByText(scenario.distinctEquivalent),
    ).toBeInTheDocument();
  } else {
    for (const entry of screen.getAllByRole('region', { name: /^(From|To)$/ })) {
      expect(entry).not.toHaveTextContent('≈');
    }
  }
});
