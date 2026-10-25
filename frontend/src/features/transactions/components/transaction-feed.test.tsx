import { screen, within } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import type { components } from '@/lib/api-schema';
import { render } from '@/test/render';
import { server } from '@/test/setup';

import { TransactionFeed } from './transaction-feed';

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
  currency: null,
  category_type: 'VARIABLE',
} satisfies components['schemas']['Account'];

const cafes = {
  ...category,
  name: 'Cafes',
  id: '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e60',
} satisfies components['schemas']['Account'];

const walletPosting = {
  id: '3e4f5a6b-7c8d-4e9f-8a0b-1c2d3e4f5a60',
  amount: '-42.80',
  currency: 'USD',
  base_amount: '-42.80',
  account: wallet,
} satisfies components['schemas']['Posting'];

const categoryPosting = {
  id: '3e4f5a6b-7c8d-4e9f-8a0b-1c2d3e4f5a61',
  amount: '42.80',
  currency: 'USD',
  base_amount: '42.80',
  account: category,
} satisfies components['schemas']['Posting'];

const expense = {
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
  postings: [walletPosting, categoryPosting],
} satisfies components['schemas']['Transaction'];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 20, 12));
  // 768 px of jsdom's window over 52 px rows give pages of 15
  document.documentElement.style.fontSize = '16px';
  document.documentElement.style.setProperty('--size-transaction-row', '3.25rem');
});

afterEach(() => {
  vi.useRealTimers();
  document.documentElement.removeAttribute('style');
});

test('loads the next page of the whole history when the end of the list comes into view', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/accounting/transactions', ({ request }) => {
      const searchParams = new URL(request.url).searchParams;
      const isFeedQuery =
        searchParams.get('size') === '15' &&
        searchParams.get('date_to') === '2026-10-20' &&
        !searchParams.has('date_from');
      if (!isFeedQuery) {
        return HttpResponse.json(null, { status: 400 });
      }

      return searchParams.get('page') === '1'
        ? HttpResponse.json({
            items: [expense],
            total: 2,
            page: 1,
            size: 15,
            pages: 2,
          } satisfies components['schemas']['Page_Transaction_'])
        : HttpResponse.json({
            items: [
              {
                ...expense,
                id: '5a1d9c3e-2b4f-4e6a-8c7d-9e0f1a2b3c41',
                postings: [
                  { ...walletPosting, amount: '-4.50', base_amount: '-4.50' },
                  { ...categoryPosting, amount: '4.50', base_amount: '4.50', account: cafes },
                ],
              },
            ],
            total: 2,
            page: 2,
            size: 15,
            pages: 2,
          } satisfies components['schemas']['Page_Transaction_']);
    }),
  );

  // act
  render(<TransactionFeed baseCurrency="USD" />);

  // assert
  const transactions = screen.getByRole('region', { name: 'Transactions' });
  expect(await within(transactions).findByText('Cafes')).toBeInTheDocument();
  expect(within(transactions).getByText('Groceries')).toBeInTheDocument();
  expect(within(transactions).getAllByRole('heading', { name: 'Today' })).toHaveLength(1);
  expect(within(transactions).getByText('-$47.30')).toBeInTheDocument();
  expect(screen.getByText('2 transactions')).toBeInTheDocument();
});

test('shows the empty state without transactions', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/accounting/transactions', () =>
      HttpResponse.json({
        items: [],
        total: 0,
        page: 1,
        size: 15,
        pages: 0,
      } satisfies components['schemas']['Page_Transaction_']),
    ),
  );

  // act
  render(<TransactionFeed baseCurrency="USD" />);

  // assert
  expect(await screen.findByText('Nothing here yet')).toBeInTheDocument();
  expect(screen.getByText('0 transactions')).toBeInTheDocument();
  expect(screen.queryByRole('list')).not.toBeInTheDocument();
});

test('shows a busy list while the first page loads', () => {
  // arrange
  server.use(
    http.get('http://localhost/api/accounting/transactions', async () => {
      await delay('infinite');
    }),
  );

  // act
  render(<TransactionFeed baseCurrency="USD" />);

  // assert
  expect(screen.getByRole('region', { name: 'Transactions' })).toHaveAttribute('aria-busy', 'true');
  expect(screen.queryByText('Nothing here yet')).not.toBeInTheDocument();
});
