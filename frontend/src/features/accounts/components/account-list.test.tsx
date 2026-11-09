import { screen } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { expect, test, vi } from 'vitest';

import type { components } from '@/lib/api-schema';
import { render } from '@/test/render';
import { server } from '@/test/setup';

import { AccountList } from './account-list';

const accounts = [
  // neither by balance nor by name, the order of their recent use the list answers
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
] satisfies components['schemas']['Account'][];

test('shows every account in the order of their recent use, in the base currency over its own', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/accounting/accounts', ({ request }) =>
      new URL(request.url).searchParams.get('size') === '100' &&
      new URL(request.url).searchParams.getAll('kinds').join() === 'ASSET,LIABILITY' &&
      new URL(request.url).searchParams.get('order') === 'recent_use'
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

  // act
  render(<AccountList baseCurrency="USD" />);

  // assert
  expect(await screen.findByText('Main card')).toBeInTheDocument();
  const items = screen.getAllByRole('listitem');
  expect(items).toHaveLength(3);
  expect(items[0]).toHaveTextContent('Main card');
  expect(items[0]).toHaveTextContent('$3,471.20€3,180.00');
  expect(items[1]).toHaveTextContent('Wallet');
  expect(items[2]).toHaveTextContent('Freelance');
  expect(items[2]).toHaveTextContent('$1,940.00');
  expect(items[2]).not.toHaveTextContent('€');
  // every account fits the wide jsdom strip, so neither arrow shows
  expect(screen.queryByRole('button', { name: 'Next accounts' })).not.toBeInTheDocument();
});

test('shows an account without a color in the first palette color', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json({
        items: accounts.slice(1, 2),
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
});

test('keeps the header when the accounts fail to load', async () => {
  // arrange
  server.use(
    http.get('http://localhost/api/accounting/accounts', () =>
      HttpResponse.json(null, { status: 500 }),
    ),
  );

  // act
  render(<AccountList baseCurrency="USD" header={<p>Total balance · USD</p>} />);

  // assert
  await vi.waitFor(() => {
    expect(screen.getByRole('region', { name: 'Accounts' })).toHaveAttribute('aria-busy', 'false');
  });
  expect(screen.getByText('Total balance · USD')).toBeInTheDocument();
  expect(screen.queryByRole('list')).not.toBeInTheDocument();
});

test('links every card to its account, marks the selected one and links All to the Accounts section', async () => {
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

  // act
  render(<AccountList baseCurrency="USD" />, {
    initialEntries: [
      `/?account=7f0c2f4e-8c1a-4b9e-9d1f-0e6a3c2b1a03&transaction=5a1d9c3e-2b4f-4e6a-8c7d-9e0f1a2b3c40`,
    ],
  });

  // assert
  const freelance = await screen.findByRole('link', { name: /^Freelance/ });
  expect(freelance).toHaveAttribute(
    'href',
    `/?transaction=5a1d9c3e-2b4f-4e6a-8c7d-9e0f1a2b3c40&account=7f0c2f4e-8c1a-4b9e-9d1f-0e6a3c2b1a01`,
  );
  expect(freelance).not.toHaveAttribute('aria-current');
  expect(screen.getByRole('link', { name: /^Wallet/ })).toHaveAttribute('aria-current', 'true');
  expect(screen.getByRole('link', { name: 'All' })).toHaveAttribute('href', '/accounts');
});
