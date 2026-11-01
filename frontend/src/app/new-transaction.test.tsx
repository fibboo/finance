import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, expect, test } from 'vitest';

import { NewTransaction } from '@/app/new-transaction';
import type { components } from '@/lib/api-schema';
import { render } from '@/test/render';
import { server } from '@/test/setup';

const wallet = {
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
} satisfies components['schemas']['Account'];

beforeEach(() => {
  server.use(
    http.get('http://localhost/api/user/me', () =>
      HttpResponse.json({
        id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
        username: 'nikita',
        avatar: null,
        registration_provider: 'GOOGLE',
        base_currency: 'USD',
        external_users: [],
      } satisfies components['schemas']['User']),
    ),
    http.get('http://localhost/api/dictionaries/accounting', () =>
      HttpResponse.json({
        currencies: [],
        account_kinds: [],
        category_types: [],
        transaction_types: [{ key: 'ADJUSTMENT', label: 'Adjustment' }],
        transaction_orders: [],
      } satisfies components['schemas']['AccountingDictionaries']),
    ),
    http.get('http://localhost/api/accounting/accounts', ({ request }) => {
      const kinds = new URL(request.url).searchParams.getAll('kinds');
      const items = kinds.includes('ASSET') && kinds.includes('LIABILITY') ? [wallet] : [];
      return HttpResponse.json({
        items,
        total: items.length,
        page: 1,
        size: 100,
        pages: 1,
      } satisfies components['schemas']['Page_Account_']);
    }),
  );
});

test('lists the money accounts in the account picker', async () => {
  // arrange
  const user = userEvent.setup();
  render(<NewTransaction />, { initialEntries: ['/?new_transaction=ADJUSTMENT'] });

  // act
  await user.click(await screen.findByRole('button', { name: /^Account/ }));

  // assert
  expect(await screen.findByRole('button', { name: /^Wallet/ })).toBeInTheDocument();
});

test.each(['{Escape}', 'close button'])('closes the form with the %s', async (closeWith) => {
  // arrange
  const user = userEvent.setup();
  render(<NewTransaction />, { initialEntries: ['/?new_transaction=ADJUSTMENT'] });
  const closeButton = await screen.findByRole('button', { name: 'Close' });

  // act
  if (closeWith === 'close button') {
    await user.click(closeButton);
  } else {
    await user.keyboard(closeWith);
  }

  // assert
  expect(screen.queryByRole('dialog', { name: 'New transaction' })).not.toBeInTheDocument();
});

test('stays closed without the new transaction param', () => {
  // act
  render(<NewTransaction />, { initialEntries: ['/?new_transaction=LOAN'] });

  // assert
  expect(screen.queryByRole('dialog', { name: 'New transaction' })).not.toBeInTheDocument();
});

test('leaves the account picker for the form with Escape', async () => {
  // arrange
  const user = userEvent.setup();
  render(<NewTransaction />, { initialEntries: ['/?new_transaction=ADJUSTMENT'] });
  await user.click(await screen.findByRole('button', { name: /^Account/ }));
  await screen.findByRole('searchbox', { name: 'Search accounts' });

  // act
  await user.keyboard('{Escape}');

  // assert
  expect(screen.getByRole('button', { name: 'Adjust balance' })).toBeVisible();
});
