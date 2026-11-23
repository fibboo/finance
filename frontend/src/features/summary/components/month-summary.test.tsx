import { screen, within } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import type { components } from '@/lib/api-schema';
import { render } from '@/test/render';
import { server } from '@/test/setup';

import { MonthSummary } from './month-summary';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 26, 12, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

test('shows what the month earned, spent and left against the days gone', async () => {
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
  render(<MonthSummary baseCurrency="USD" />);

  // assert
  const month = screen.getByRole('region', { name: 'This month' });
  expect(await within(month).findByText('+$2,312.00')).toBeInTheDocument();
  expect(within(month).getAllByText('-$1,046.70')).toHaveLength(2);
  expect(within(month).getByText('$1,265.30')).toBeInTheDocument();
  expect(
    within(month).getByText('45% of the earnings spent, 84% of the month gone'),
  ).toBeInTheDocument();
  expect(within(month).queryByText('Unvalued spending')).not.toBeInTheDocument();
});

test('shows the unvalued spending of every currency apart, with its estimate as spending', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/accounting/summary', () =>
      HttpResponse.json({
        month: '2026-10-01',
        total_balance: '13713.25',
        estimated_total_balance: '13300.00',
        earned: '2312.00',
        spent: '1046.70',
        left_over: '1265.30',
        unvalued_spent: [
          { currency: 'EUR', amount: '300.00' },
          { currency: 'RSD', amount: '1200.00' },
        ],
        estimated_unvalued_spent: '335.25',
        estimate_rates: [],
      } satisfies components['schemas']['Summary']),
    ),
  );

  // act
  render(<MonthSummary baseCurrency="USD" />);

  // assert
  const month = screen.getByRole('region', { name: 'This month' });
  expect(await within(month).findByText('Unvalued spending')).toBeInTheDocument();
  expect(within(month).getByText('≈ -$335.25')).toBeInTheDocument();
  expect(within(month).getByText('€300.00 · RSD 1,200.00')).toBeInTheDocument();
  // spent and left stay valued amounts
  expect(within(month).getAllByText('-$1,046.70')).toHaveLength(2);
  expect(within(month).getByText('$1,265.30')).toBeInTheDocument();
  expect(within(month).queryByText('No estimate available')).not.toBeInTheDocument();
});

test('keeps the unvalued spending without an estimate and says it is left out of Spent and Left', async () => {
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
        unvalued_spent: [{ currency: 'EUR', amount: '300.00' }],
        estimated_unvalued_spent: null,
        estimate_rates: [],
      } satisfies components['schemas']['Summary']),
    ),
  );

  // act
  render(<MonthSummary baseCurrency="USD" />);

  // assert
  const month = screen.getByRole('region', { name: 'This month' });
  expect(await within(month).findByText('No estimate available')).toBeInTheDocument();
  expect(within(month).getByText('€300.00')).toBeInTheDocument();
  expect(
    within(month).getByText('Not included in Spent or Left. Estimates are unavailable.'),
  ).toBeInTheDocument();
});

test('shows a negative left over with its minus', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/accounting/summary', () =>
      HttpResponse.json({
        month: '2026-10-01',
        total_balance: '13713.25',
        estimated_total_balance: null,
        earned: '0.00',
        spent: '200.00',
        left_over: '-200.00',
        unvalued_spent: [],
        estimated_unvalued_spent: null,
        estimate_rates: [],
      } satisfies components['schemas']['Summary']),
    ),
  );

  // act
  render(<MonthSummary baseCurrency="USD" />);

  // assert
  expect(await screen.findAllByText('-$200.00')).toHaveLength(3);
  expect(screen.getAllByText('$0.00')).toHaveLength(3);
  expect(screen.getByText('100% of the earnings spent, 84% of the month gone')).toBeInTheDocument();
});

test('counts no days gone for a month the backend has started before the local today', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/accounting/summary', () =>
      HttpResponse.json({
        month: '2026-11-01',
        total_balance: '13713.25',
        estimated_total_balance: null,
        earned: '0.00',
        spent: '0.00',
        left_over: '0.00',
        unvalued_spent: [],
        estimated_unvalued_spent: null,
        estimate_rates: [],
      } satisfies components['schemas']['Summary']),
    ),
  );

  // act
  render(<MonthSummary baseCurrency="USD" />);

  // assert
  expect(
    await screen.findByText('0% of the earnings spent, 0% of the month gone'),
  ).toBeInTheDocument();
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
  expect(screen.queryByText('Gross')).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'This month' })).toBeInTheDocument();
});

test.each([
  { gross: '5000.00', costs: '1000.00', net: '4000.00', personal: '1600.00', left: '2400.00' },
  { gross: '500.00', costs: '1000.00', net: '-500.00', personal: '1600.00', left: '-2100.00' },
])(
  'shows the API income breakdown for gross $gross without changing the progress calculation',
  async ({ gross, costs, net, personal, left }) => {
    // arrange
    server.use(
      http.get('http://localhost/api/accounting/summary', () =>
        HttpResponse.json({
          month: '2026-10-01',
          total_balance: '0.00',
          estimated_total_balance: null,
          earned: gross,
          spent: '2600.00',
          left_over: left,
          income_costs: costs,
          net_income: net,
          personal_spending: personal,
          unvalued_spent: [],
          estimated_unvalued_spent: null,
          estimate_rates: [],
        } satisfies components['schemas']['Summary']),
      ),
    );

    // act
    render(<MonthSummary baseCurrency="EUR" />);

    // assert
    expect(await screen.findByText('Net income')).toBeInTheDocument();
    expect(screen.getByText(net === '4000.00' ? '€4,000.00' : '-€500.00')).toBeInTheDocument();
    expect(screen.getByText('-€1,000.00')).toBeInTheDocument();
    expect(screen.getByText('-€1,600.00')).toBeInTheDocument();
    expect(screen.getByText('Gross')).toBeInTheDocument();
    expect(
      screen.getByText(
        gross === '5000.00'
          ? '52% of the earnings spent, 84% of the month gone'
          : '100% of the earnings spent, 84% of the month gone',
      ),
    ).toBeInTheDocument();
  },
);
