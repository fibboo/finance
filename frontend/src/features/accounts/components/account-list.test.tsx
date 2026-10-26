import { screen } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { expect, test, vi } from 'vitest';

import type { components } from '@/lib/api-schema';
import { render } from '@/test/render';
import { server } from '@/test/setup';

import { AccountList } from './account-list';

const accounts = [
  {
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
  {
    name: 'Main card',
    id: '7f0c2f4e-8c1a-4b9e-9d1f-0e6a3c2b1a02',
    user_id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
    kind: 'ASSET',
    balance: '3180.00',
    currency: 'EUR',
    color: '#5B6CD9',
    category_type: null,
    base_currency_rate: '0.9161',
    status: 'ACTIVE',
    base_currency_balance: '3471.20',
  },
  {
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
  },
] satisfies components['schemas']['Account'][];

test('shows the largest accounts that fit, with the base currency equivalent', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/accounting/accounts', ({ request }) =>
      new URL(request.url).searchParams.get('size') === '100' &&
      new URL(request.url).searchParams.getAll('kinds').join() === 'ASSET,LIABILITY'
        ? HttpResponse.json({
            items: accounts,
            total: 3,
            page: 1,
            size: 100,
            pages: 1,
          } satisfies components['schemas']['Page_Account_'])
        : HttpResponse.json(null, { status: 400 }),
    ),
  );
  // the desktop grid measures room for two tiles in its one row
  vi.stubGlobal('getComputedStyle', () => ({
    display: 'grid',
    gridTemplateColumns: '200px 200px',
    getPropertyValue: () => '',
  }));

  // act
  render(<AccountList baseCurrency="USD" />);

  // assert
  expect(await screen.findByText('Main card')).toBeInTheDocument();
  const items = screen.getAllByRole('listitem');
  expect(items).toHaveLength(2);
  expect(items[0]).toHaveTextContent('Main card');
  expect(items[0]).toHaveTextContent('€3,180.00');
  expect(items[0]).toHaveTextContent('≈ $3,471.20');
  expect(items[1]).toHaveTextContent('Freelance');
  expect(items[1]).not.toHaveTextContent('≈');
  expect(screen.queryByText('Wallet')).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Accounts 3' })).toBeInTheDocument();
});

test('shows every account in the phone strip', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items: accounts,
        total: 3,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']),
    ),
  );
  // the phone strip is a scrolling flex row
  vi.stubGlobal('getComputedStyle', () => ({
    display: 'flex',
    gridTemplateColumns: 'none',
    getPropertyValue: () => '',
  }));

  // act
  render(<AccountList baseCurrency="USD" />);

  // assert
  expect(await screen.findByText('Wallet')).toBeInTheDocument();
  expect(screen.getAllByRole('listitem')).toHaveLength(3);
});

test('shows an account without a color in the first palette color', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items: accounts.slice(2),
        total: 1,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']),
    ),
  );

  // act
  render(<AccountList baseCurrency="USD" />);

  // assert
  expect(await screen.findByText('W')).toHaveStyle({ color: 'rgb(77, 143, 191)' });
  expect(screen.getByText('$412.50')).toBeInTheDocument();
});

test('shows a busy accounts panel while the accounts load', () => {
  // arrange
  server.use(
    http.get('http://localhost/api/accounting/accounts', async () => {
      await delay('infinite');
    }),
  );

  // act
  render(<AccountList baseCurrency="USD" />);

  // assert
  expect(screen.getByRole('region', { name: 'Accounts' })).toHaveAttribute('aria-busy', 'true');
  expect(screen.getByRole('heading', { name: 'Accounts' })).toBeInTheDocument();
});
