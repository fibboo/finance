import { screen, within } from '@testing-library/react';
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
        estimated_total_balance: null,
        earned: '2312.00',
        spent: '1046.70',
        left_over: '1265.30',
        unvalued_spent: [],
        estimated_unvalued_spent: null,
        estimate_rates: [],
      } satisfies components['schemas']['Summary']),
    ),
  );

  // act
  render(<TotalBalance baseCurrency="USD" />);

  // assert
  expect(await screen.findByText('$13,713.25')).toBeInTheDocument();
  expect(screen.getByText('Total balance · USD')).toBeInTheDocument();
  expect(screen.queryByRole('list', { name: 'Applied exchange rates' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /ExchangeRate-API/ })).not.toBeInTheDocument();
});

test.each([
  { kind: 'a positive', estimate: '13400.10', text: '≈ $13,400.10' },
  { kind: 'a negative', estimate: '-250.00', text: '≈ -$250.00' },
  { kind: 'a zero', estimate: '0.00', text: '≈ $0.00' },
])('shows $kind estimated total in place of the valued one', async ({ estimate, text }) => {
  // arrange
  server.use(
    http.get('http://localhost/api/accounting/summary', () =>
      HttpResponse.json({
        month: '2026-10-01',
        total_balance: '13713.25',
        estimated_total_balance: estimate,
        earned: '2312.00',
        spent: '1046.70',
        left_over: '1265.30',
        unvalued_spent: [],
        estimated_unvalued_spent: null,
        estimate_rates: [],
      } satisfies components['schemas']['Summary']),
    ),
  );

  // act
  render(<TotalBalance baseCurrency="USD" />);

  // assert
  expect(await screen.findByText(text)).toBeInTheDocument();
  expect(screen.queryByText('$13,713.25')).not.toBeInTheDocument();
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

test.each([
  {
    rates: [{ currency: 'EUR', rate: '1.08123' }],
    expected: ['1 EUR = $1.08'],
  },
  {
    rates: [
      { currency: 'GBP', rate: '1.27' },
      { currency: 'EUR', rate: '1.08' },
    ],
    expected: ['1 GBP = $1.27', '1 EUR = $1.08'],
  },
  {
    rates: [
      { currency: 'JPY', rate: '0.0067' },
      { currency: 'VND', rate: '0.000039' },
      { currency: 'INR', rate: '0.01' },
    ],
    expected: ['1 JPY = $0.0067', '1 VND = $0.000039', '1 INR = $0.01'],
  },
])(
  'shows the applied rates in API order and links their source ($expected)',
  async ({ rates, expected }) => {
    // arrange
    server.use(
      http.get('http://localhost/api/accounting/summary', () =>
        HttpResponse.json({
          month: '2026-10-01',
          total_balance: '13713.25',
          estimated_total_balance: '13400.10',
          earned: '2312.00',
          spent: '1046.70',
          left_over: '1265.30',
          unvalued_spent: [],
          estimated_unvalued_spent: null,
          estimate_rates: rates,
        } satisfies components['schemas']['Summary']),
      ),
    );

    // act
    render(<TotalBalance baseCurrency="USD" />);

    // assert
    const rateList = await screen.findByRole('list', { name: 'Applied exchange rates' });
    expect(
      within(rateList)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(expected);
    const source = screen.getByRole('link', {
      name: 'Unknown account rates use public market data. ExchangeRate-API (opens in a new tab)',
    });
    expect(source).toHaveAttribute('href', 'https://www.exchangerate-api.com');
    expect(source).toHaveAttribute('target', '_blank');
    expect(source).toHaveTextContent('Unknown account rates use public market data.');
    expect(source).toHaveAttribute('title', 'Unknown account rates use public market data.');
  },
);
