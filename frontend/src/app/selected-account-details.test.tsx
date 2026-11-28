import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { expect, test, vi } from 'vitest';

import { readAccountLinkId } from '@/features/accounts/api/selected-account';
import type { components } from '@/lib/api-schema';
import { render } from '@/test/render';
import { server } from '@/test/setup';

import { SelectedAccountDetails } from './selected-account-details';

const account = {
  id: '7f0c2f4e-8c1a-4b9e-9d1f-0e6a3c2b1a03',
  user_id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
  name: 'Savings',
  kind: 'ASSET',
  balance: '412.50',
  currency: 'USD',
  color: null,
  category_type: null,
  base_currency_rate: '1',
  status: 'ACTIVE',
  base_currency_balance: '412.50',
} satisfies components['schemas']['Account'];

test.each([
  { scenario: 'the default account on a phone', width: 384, search: '/', scrollLeft: 42 },
  { scenario: 'the default account below desktop width', width: 1023, search: '/', scrollLeft: 42 },
  { scenario: 'the default account at desktop width', width: 1024, search: '/', scrollLeft: 472 },
  { scenario: 'the default account on desktop', width: 1707, search: '/', scrollLeft: 472 },
  {
    scenario: 'a selected account on a phone',
    width: 384,
    search: `/?account=${account.id}`,
    scrollLeft: 472,
  },
])('keeps the expected strip position for $scenario', async ({ width, search, scrollLeft }) => {
  // arrange
  vi.stubGlobal('innerWidth', width);
  server.use(
    http.get(`http://localhost/api/accounting/accounts/${account.id}`, () =>
      HttpResponse.json(account),
    ),
    http.get('http://localhost/api/dictionaries/accounting', () =>
      HttpResponse.json({
        currencies: [{ key: 'USD', label: 'US Dollar' }],
        account_kinds: [{ key: 'ASSET', label: 'Asset' }],
        category_types: [],
        transaction_types: [],
        transaction_orders: [],
      } satisfies components['schemas']['AccountingDictionaries']),
    ),
  );

  // act
  render(
    <>
      <ul
        aria-label="Accounts"
        ref={(strip) => {
          if (strip !== null) {
            strip.style.overflowX = 'auto';
            strip.scrollLeft = 42;
            strip.getBoundingClientRect = () => new DOMRect(0, 0, 300, 100);
            strip.scrollTo = (options?: ScrollToOptions | number) => {
              if (typeof options === 'object' && options.left !== undefined) {
                strip.scrollLeft = options.left;
              }
            };
          }
        }}
      >
        <li>
          <a
            id={readAccountLinkId(account.id)}
            href={`/?account=${account.id}`}
            ref={(link) => {
              if (link !== null) {
                link.getBoundingClientRect = () => new DOMRect(430, 0, 120, 100);
              }
            }}
          >
            Off-screen account
          </a>
        </li>
      </ul>
      <SelectedAccountDetails
        form="panel"
        baseCurrency="USD"
        accountCount={3}
        shownAccount={{
          kind: 'selected',
          defaultAccountId: account.id,
          isDefaultAccountPending: false,
          isParamIgnored: false,
        }}
        isKeptOpenOnDesktop
        isMoneyAccountOnly
      />
    </>,
    { initialEntries: [search] },
  );

  // assert
  await screen.findByText('Savings');
  expect(screen.getByRole('list', { name: 'Accounts' }).scrollLeft).toBe(scrollLeft);
});

test('shows the account when its types fail to load', async () => {
  // arrange
  let isTypeRequestFailed = false;
  server.use(
    http.get(`http://localhost/api/accounting/accounts/${account.id}`, () =>
      HttpResponse.json(account),
    ),
    http.get('http://localhost/api/accounting/classifications/MONEY_ACCOUNT', () => {
      isTypeRequestFailed = true;
      return HttpResponse.json({ message: 'Internal server error' }, { status: 500 });
    }),
    http.get('http://localhost/api/dictionaries/accounting', () =>
      HttpResponse.json({
        currencies: [{ key: 'USD', label: 'US Dollar' }],
        account_kinds: [{ key: 'ASSET', label: 'Asset' }],
        category_types: [],
        transaction_types: [],
        transaction_orders: [],
      } satisfies components['schemas']['AccountingDictionaries']),
    ),
  );

  // act
  render(
    <SelectedAccountDetails
      form="panel"
      baseCurrency="USD"
      accountCount={3}
      shownAccount={{
        kind: 'selected',
        defaultAccountId: account.id,
        isDefaultAccountPending: false,
        isParamIgnored: false,
      }}
      isKeptOpenOnDesktop
      isMoneyAccountOnly
    />,
  );

  // assert
  await waitFor(() => {
    expect(isTypeRequestFailed).toBe(true);
  });
  expect(await screen.findByRole('heading', { level: 2, name: 'Savings' })).toBeInTheDocument();
  expect(await screen.findByText('USD')).toBeInTheDocument();
});
