import { screen, within } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import type { components } from '@/lib/api-schema';
import { render } from '@/test/render';
import { server } from '@/test/setup';

import { RecentTransactions } from './recent-transactions';

const income = {
  id: '5a1d9c3e-2b4f-4e6a-8c7d-9e0f1a2b3c4d',
  user_id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
  transaction_date: '2026-03-02',
  comment: null,
  base_currency_amount: '640.00',
  location: null,
  income_period: '2026-03-01',
  transaction_type: 'INCOME',
  status: 'ACTIVE',
  created_at: '2026-10-14T09:00:00Z',
  updated_at: '2026-10-14T09:00:00Z',
  postings: [
    {
      id: '9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b61',
      amount: '-640.00',
      currency: 'USD',
      base_amount: '-640.00',
      account: {
        name: 'Design project',
        id: '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f',
        user_id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
        kind: 'INCOME',
        balance: '0',
        currency: null,
        color: null,
        category_type: null,
        base_currency_rate: '0',
        status: 'ACTIVE',
        base_currency_balance: '0.00',
      },
    },
    {
      id: '9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b62',
      amount: '640.00',
      currency: 'USD',
      base_amount: '640.00',
      account: {
        name: 'Freelance',
        id: '7f0c2f4e-8c1a-4b9e-9d1f-0e6a3c2b1a01',
        user_id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
        kind: 'ASSET',
        balance: '1940.00',
        currency: 'USD',
        color: '#A15CB8',
        category_type: null,
        base_currency_rate: '1',
        status: 'ACTIVE',
        base_currency_balance: '1940.00',
      },
    },
  ],
} satisfies components['schemas']['Transaction'];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 20, 0, 30));
  // 768 px of jsdom's window over 52 px rows give pages of 15
  document.documentElement.style.fontSize = '16px';
  document.documentElement.style.setProperty('--size-transaction-row', '3.25rem');
});

afterEach(() => {
  vi.useRealTimers();
  document.documentElement.removeAttribute('style');
});

test('shows the latest transactions of the whole history up to the local today', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/accounting/transactions', ({ request }) => {
      const searchParams = new URL(request.url).searchParams;
      return searchParams.get('size') === '15' &&
        !searchParams.has('date_from') &&
        searchParams.get('date_to') === '2026-10-20'
        ? HttpResponse.json({
            items: [income],
            total: 1,
            page: 1,
            size: 15,
            pages: 1,
          } satisfies components['schemas']['Page_Transaction_'])
        : HttpResponse.json(null, { status: 400 });
    }),
  );

  // act
  render(<RecentTransactions baseCurrency="USD" />);

  // assert
  const row = await screen.findByRole('listitem');
  expect(row).toHaveTextContent('Design project');
  expect(row).toHaveTextContent('+$640.00');
  expect(row).toHaveTextContent('≈ +$640.00');
  expect(screen.getByRole('heading', { name: 'Mon, Mar 2' })).toBeInTheDocument();
  expect(screen.queryByText('Nothing here yet')).not.toBeInTheDocument();
});

test('loads the next page when the end of Recent comes into view', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/accounting/transactions', ({ request }) =>
      new URL(request.url).searchParams.get('page') === '1'
        ? HttpResponse.json({
            items: [income],
            total: 2,
            page: 1,
            size: 15,
            pages: 2,
          } satisfies components['schemas']['Page_Transaction_'])
        : HttpResponse.json({
            items: [
              {
                ...income,
                id: '5a1d9c3e-2b4f-4e6a-8c7d-9e0f1a2b3c4e',
                transaction_date: '2026-03-01',
                postings: income.postings.map((posting) => ({
                  ...posting,
                  account:
                    posting.account.kind === 'INCOME'
                      ? { ...posting.account, name: 'Consulting' }
                      : posting.account,
                })),
              },
            ],
            total: 2,
            page: 2,
            size: 15,
            pages: 2,
          } satisfies components['schemas']['Page_Transaction_']),
    ),
  );

  // act
  render(<RecentTransactions baseCurrency="USD" />);

  // assert
  const recent = screen.getByRole('region', { name: 'Recent' });
  expect(await within(recent).findByText('Consulting')).toBeInTheDocument();
  expect(within(recent).getByText('Design project')).toBeInTheDocument();
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
  render(<RecentTransactions baseCurrency="USD" />);

  // assert
  expect(await screen.findByText('Nothing here yet')).toBeInTheDocument();
  expect(screen.getByText('Your income and expenses will show up here.')).toBeInTheDocument();
  expect(screen.queryByRole('list')).not.toBeInTheDocument();
});

test('shows a busy recent panel while the transactions load', () => {
  // arrange
  server.use(
    http.get('http://localhost/api/accounting/transactions', async () => {
      await delay('infinite');
    }),
  );

  // act
  render(<RecentTransactions baseCurrency="USD" />);

  // assert
  expect(screen.getByRole('region', { name: 'Recent' })).toHaveAttribute('aria-busy', 'true');
  expect(screen.queryByText('Nothing here yet')).not.toBeInTheDocument();
});
