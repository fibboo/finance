import { screen } from '@testing-library/react';
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
  { currency: 'GBP', estimatedBaseAmount: '-109.16', pairRate: 'GBP 0.8790', baseRate: '0.9161' },
  { currency: 'EUR', estimatedBaseAmount: '-109.16', pairRate: null, baseRate: '0.9161' },
  { currency: 'EUR', estimatedBaseAmount: '0.00', pairRate: null, baseRate: null },
])(
  'shows the rates supported by the postings for $currency at $estimatedBaseAmount',
  ({ currency, estimatedBaseAmount, pairRate, baseRate }) => {
    // arrange
    const destination = {
      ...source,
      id: '7f0c2f4e-8c1a-4b9e-9d1f-0e6a3c2b1a04',
      name: 'Savings',
      currency,
    };
    const postings = [
      {
        id: '3e4f5a6b-7c8d-4e9f-8a0b-1c2d3e4f5a6a',
        account: source,
        currency: 'EUR',
        amount: '-100.00',
        base_amount: null,
        estimated_base_amount: estimatedBaseAmount,
      },
      {
        id: '3e4f5a6b-7c8d-4e9f-8a0b-1c2d3e4f5a6b',
        account: destination,
        currency,
        amount: currency === 'EUR' ? '100.00' : '87.90',
        base_amount: null,
      },
    ] satisfies components['schemas']['Posting'][];

    // act
    render(
      <TransactionOverview
        transaction={{ ...transfer, postings }}
        baseCurrency="USD"
        transactionTypes={[{ key: 'TRANSFER', label: 'Transfer' }]}
        accountKinds={[{ key: 'ASSET', label: 'Asset' }]}
        categoryTypes={[]}
        readAccountLink={() => undefined}
        readLocationLink={() => undefined}
        closeButton={null}
        editAction={null}
        deleteAction={null}
      />,
    );

    // assert
    expect(screen.getByRole('article')).toHaveTextContent(
      baseRate === null ? '€100.00≈ $0.00From' : '€100.00≈ $109.16 · rate 0.9161From',
    );
    if (pairRate === null) {
      expect(screen.queryByText('Rate', { exact: true })).not.toBeInTheDocument();
    } else {
      expect(screen.getByText('Rate').parentElement).toHaveTextContent(
        `Rate${pairRate}Location—Comment—`,
      );
    }
  },
);
