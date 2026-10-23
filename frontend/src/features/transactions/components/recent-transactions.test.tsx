import { screen } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import type { components } from '@/lib/api-schema';
import { render } from '@/test/render';
import { server } from '@/test/setup';

import { RecentTransactions } from './recent-transactions';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 20, 0, 30));
});

afterEach(() => {
  vi.useRealTimers();
});

test('shows the latest transactions of the whole history up to the local today', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/accounting/transactions', ({ request }) => {
      const searchParams = new URL(request.url).searchParams;
      return searchParams.get('size') === '6' &&
        searchParams.get('date_from') === '0001-01-01' &&
        searchParams.get('date_to') === '2026-10-20'
        ? HttpResponse.json({
            items: [
              {
                id: '5a1d9c3e-2b4f-4e6a-8c7d-9e0f1a2b3c4d',
                user_id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
                transaction_date: '2026-03-02',
                source_amount: '640.00',
                source_currency: 'USD',
                destination_amount: '640.00',
                destination_currency: 'USD',
                base_currency_amount: '640.00',
                transaction_type: 'INCOME',
                status: 'ACTIVE',
                created_at: '2026-10-14T09:00:00Z',
                updated_at: '2026-10-14T09:00:00Z',
                income_source: {
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
                to_account: {
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
            total: 1,
            page: 1,
            size: 6,
            pages: 1,
          } satisfies components['schemas']['Page_Transaction_'])
        : HttpResponse.json(null, { status: 400 });
    }),
  );

  // act
  render(<RecentTransactions />);

  // assert
  expect(await screen.findByRole('listitem')).toHaveTextContent('Design project');
  expect(screen.getByText('+$640.00')).toBeInTheDocument();
  expect(screen.getByText('Mar 2', { exact: false })).toBeInTheDocument();
  expect(screen.queryByText('Nothing here yet')).not.toBeInTheDocument();
});

test('shows the empty state without transactions', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/accounting/transactions', () =>
      HttpResponse.json({
        items: [],
        total: 0,
        page: 1,
        size: 6,
        pages: 0,
      } satisfies components['schemas']['Page_Transaction_']),
    ),
  );

  // act
  render(<RecentTransactions />);

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
  render(<RecentTransactions />);

  // assert
  expect(screen.getByRole('region', { name: 'Recent' })).toHaveAttribute('aria-busy', 'true');
  expect(screen.queryByText('Nothing here yet')).not.toBeInTheDocument();
});
