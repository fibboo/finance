import { screen } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { expect, test } from 'vitest';

import type { components } from '@/lib/api-schema';
import { render } from '@/test/render';
import { server } from '@/test/setup';

import { BalancePanel } from './balance-panel';

test('shows the total balance and the month in the base currency', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/accounting/summary', () =>
      HttpResponse.json({
        month: '2026-10-01',
        total_balance: '13713.25',
        earned: '2312.00',
        spent: '1046.70',
        left_over: '1265.30',
      } satisfies components['schemas']['Summary']),
    ),
  );

  // act
  render(<BalancePanel baseCurrency="USD" />);

  // assert
  expect(await screen.findByText('$13,713.25')).toBeInTheDocument();
  expect(screen.getByText('Total balance · USD')).toBeInTheDocument();
  expect(screen.getByText('+$2,312.00')).toBeInTheDocument();
  expect(screen.getByText('-$1,046.70')).toBeInTheDocument();
  expect(screen.getByText('+$1,265.30')).toBeInTheDocument();
});

test('shows zero amounts without a sign', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/accounting/summary', () =>
      HttpResponse.json({
        month: '2026-10-01',
        total_balance: '0.00',
        earned: '0.00',
        spent: '0.00',
        left_over: '0.00',
      } satisfies components['schemas']['Summary']),
    ),
  );

  // act
  render(<BalancePanel baseCurrency="EUR" />);

  // assert
  expect(await screen.findAllByText('€0.00')).toHaveLength(4);
});

test('shows a busy balance panel while the summary loads', () => {
  // arrange
  server.use(
    http.get('http://localhost/api/accounting/summary', async () => {
      await delay('infinite');
    }),
  );

  // act
  render(<BalancePanel baseCurrency="USD" />);

  // assert
  expect(screen.getByRole('region', { name: 'Balance' })).toHaveAttribute('aria-busy', 'true');
  expect(screen.getByText('This month')).toBeInTheDocument();
  expect(screen.queryByText('Total balance · USD')).not.toBeInTheDocument();
});
