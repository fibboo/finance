import { screen, within } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { expect, test } from 'vitest';

import type { components } from '@/lib/api-schema';
import { render } from '@/test/render';
import { server } from '@/test/setup';

import { MonthSummary } from './month-summary';

test('shows what the month earned, spent and left in the base currency', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/accounting/summary', () =>
      HttpResponse.json({
        month: '2026-10-01',
        total_balance: '13713.25',
        earned: '2312.00',
        spent: '1046.70',
        left_over: '1265.30',
        unvalued_spent: [],
      } satisfies components['schemas']['Summary']),
    ),
  );

  // act
  render(<MonthSummary baseCurrency="USD" />);

  // assert
  const month = screen.getByRole('region', { name: 'This month' });
  expect(await within(month).findByText('+$2,312.00')).toBeInTheDocument();
  expect(within(month).getByText('-$1,046.70')).toBeInTheDocument();
  expect(within(month).getByText('$1,265.30')).toBeInTheDocument();
  expect(within(month).getByText('Left')).toBeInTheDocument();
});

test('shows a negative left over with its minus', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/accounting/summary', () =>
      HttpResponse.json({
        month: '2026-10-01',
        total_balance: '13713.25',
        earned: '0.00',
        spent: '200.00',
        left_over: '-200.00',
        unvalued_spent: [],
      } satisfies components['schemas']['Summary']),
    ),
  );

  // act
  render(<MonthSummary baseCurrency="USD" />);

  // assert
  expect(await screen.findAllByText('-$200.00')).toHaveLength(2);
  expect(screen.getByText('$0.00')).toBeInTheDocument();
});

test('shows a busy month while the summary loads', () => {
  // arrange
  server.use(
    http.get('http://localhost/api/accounting/summary', async () => {
      await delay('infinite');
    }),
  );

  // act
  render(<MonthSummary baseCurrency="USD" />);

  // assert
  expect(screen.getByRole('region', { name: 'This month' })).toHaveAttribute('aria-busy', 'true');
  expect(screen.queryByText('Earned')).not.toBeInTheDocument();
});
