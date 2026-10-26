import { screen } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { expect, test } from 'vitest';

import type { components } from '@/lib/api-schema';
import { render } from '@/test/render';
import { server } from '@/test/setup';

import { TotalBalance } from './total-balance';

test('shows the total balance in the base currency', async () => {
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
  render(<TotalBalance baseCurrency="USD" />);

  // assert
  expect(await screen.findByText('$13,713.25')).toBeInTheDocument();
  expect(screen.getByText('Total balance · USD')).toBeInTheDocument();
});

test('shows no total while the summary loads', () => {
  // arrange
  server.use(
    http.get('http://localhost/api/accounting/summary', async () => {
      await delay('infinite');
    }),
  );

  // act
  render(<TotalBalance baseCurrency="USD" />);

  // assert
  expect(screen.queryByText('Total balance · USD')).not.toBeInTheDocument();
});
