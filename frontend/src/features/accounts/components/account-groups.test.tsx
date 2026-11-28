import { screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { expect, test } from 'vitest';

import type { components } from '@/lib/api-schema';
import { render } from '@/test/render';

import { AccountGroups } from './account-groups';

const wallet = {
  name: 'Wallet',
  id: '7f0c2f4e-8c1a-4b9e-9d1f-0e6a3c2b1a03',
  user_id: '0b5c1f0e-1d7b-4a52-9f3a-2f1a6f0c8d11',
  kind: 'ASSET',
  balance: '412.50',
  currency: 'USD',
  color: '#4D8FBF',
  base_currency_rate: '1',
  status: 'ACTIVE',
  base_currency_balance: '412.50',
} satisfies components['schemas']['Account'];

const mainCard = {
  ...wallet,
  name: 'Main card',
  id: '7f0c2f4e-8c1a-4b9e-9d1f-0e6a3c2b1a02',
  balance: '3180.00',
  currency: 'EUR',
  color: '#5B6CD9',
  base_currency_rate: '0.9161',
  base_currency_balance: '3471.20',
} satisfies components['schemas']['Account'];

const savings = {
  ...wallet,
  name: 'Savings',
  id: '7f0c2f4e-8c1a-4b9e-9d1f-0e6a3c2b1a06',
  balance: '1000.00',
  color: '#A15CB8',
  base_currency_balance: '1000.00',
} satisfies components['schemas']['Account'];

const visaCredit = {
  ...wallet,
  name: 'Visa credit',
  id: '8c1a7f0c-2f4e-4b9e-9d1f-0e6a3c2b1a04',
  kind: 'ASSET',
  balance: '-318.40',
  color: '#C2613F',
  base_currency_balance: '-318.40',
} satisfies components['schemas']['Account'];

const intesaCredit = {
  ...wallet,
  name: 'Intesa credit',
  id: '8c1a7f0c-2f4e-4b9e-9d1f-0e6a3c2b1a05',
  kind: 'ASSET',
  balance: '-1240.00',
  currency: 'EUR',
  color: '#8A6FD1',
  base_currency_rate: '0.8545',
  base_currency_balance: '-1451.20',
} satisfies components['schemas']['Account'];

const amexCredit = {
  ...visaCredit,
  name: 'Amex credit',
  id: '8c1a7f0c-2f4e-4b9e-9d1f-0e6a3c2b1a07',
  balance: '-700.00',
  color: '#3F9C8A',
  base_currency_balance: '-700.00',
} satisfies components['schemas']['Account'];

test('shows account descriptions and types in one list in the order given', () => {
  // act
  render(
    // in each group neither by balance nor by name, in either direction
    <AccountGroups
      accounts={[
        {
          ...wallet,
          description: 'Everyday cash',
          classification_id: '10000000-0000-4000-8000-000000000001',
        },
        intesaCredit,
        mainCard,
        visaCredit,
        savings,
        amexCredit,
      ]}
      classifications={[
        {
          name: 'Cash',
          id: '10000000-0000-4000-8000-000000000001',
          kind: 'MONEY_ACCOUNT',
          is_default: true,
        },
        {
          name: 'Card',
          id: '10000000-0000-4000-8000-000000000003',
          kind: 'MONEY_ACCOUNT',
          is_default: false,
        },
      ]}
      topAccountId={undefined}
      baseCurrency="USD"
      listSearchParams={new URLSearchParams()}
      isParamIgnored={false}
    />,
  );

  // assert
  const rows = within(screen.getByRole('region', { name: 'Account balances' })).getAllByRole(
    'listitem',
  );
  expect(rows).toHaveLength(6);
  expect(rows[0]).toHaveTextContent('Wallet Everyday cashCash · USD$412.50');
  expect(rows[0]).not.toHaveTextContent('$412.50$412.50');
  expect(rows[1]).toHaveTextContent('Intesa credit');
  expect(rows[2]).toHaveTextContent('Main cardEUR · 0.9161$3,471.20€3,180.00');
  expect(rows[3]).toHaveTextContent('Visa credit');
  expect(rows[4]).toHaveTextContent('Savings');
  expect(rows[5]).toHaveTextContent('Amex credit');
});

test('shows the estimated balance and rate of an account with unvalued amounts', () => {
  // act
  render(
    <AccountGroups
      accounts={[
        wallet,
        mainCard,
        {
          ...intesaCredit,
          base_currency_rate: '0',
          base_currency_balance: '0.00',
          estimated_base_balance: '-1500.00',
        },
        visaCredit,
      ]}
      classifications={undefined}
      topAccountId={undefined}
      baseCurrency="USD"
      listSearchParams={new URLSearchParams()}
      isParamIgnored={false}
    />,
  );

  // assert
  const rows = screen.getAllByRole('listitem');
  expect(rows[2]).toHaveTextContent('Intesa creditEUR · 0.8267≈ -$1,500.00-€1,240.00');
  expect(rows[0]).not.toHaveTextContent('≈');
});

test('leaves out the type label when there is one type', () => {
  // act
  render(
    <AccountGroups
      accounts={[{ ...wallet, classification_id: '10000000-0000-4000-8000-000000000001' }]}
      classifications={[
        {
          id: '10000000-0000-4000-8000-000000000001',
          name: 'Standard',
          kind: 'MONEY_ACCOUNT',
          is_default: true,
        },
      ]}
      topAccountId={undefined}
      baseCurrency="USD"
      listSearchParams={new URLSearchParams()}
      isParamIgnored={false}
    />,
  );

  // assert
  expect(screen.getByRole('listitem')).toHaveTextContent('WalletUSD');
  expect(screen.getByRole('listitem')).not.toHaveTextContent('Standard');
});

test('shows the list skeleton while the accounts are pending', () => {
  // act
  render(
    <AccountGroups
      accounts={undefined}
      classifications={undefined}
      topAccountId={undefined}
      baseCurrency="USD"
      listSearchParams={new URLSearchParams()}
      isParamIgnored={false}
    />,
  );

  // assert
  expect(screen.queryByRole('region')).not.toBeInTheDocument();
  expect(screen.getAllByRole('listitem')).toHaveLength(3);
});

test('moves the selection through the rows with the arrow keys', async () => {
  // arrange
  const user = userEvent.setup();
  render(
    <AccountGroups
      accounts={[wallet, savings, intesaCredit]}
      classifications={undefined}
      topAccountId={undefined}
      baseCurrency="USD"
      listSearchParams={new URLSearchParams()}
      isParamIgnored={false}
    />,
  );
  await user.tab();

  // act
  // past the last row the selection stays, so Up from there returns to the previous account
  await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{ArrowUp}');

  // assert
  const savingsLink = screen.getByRole('link', { name: 'Savings' });
  expect(savingsLink).toHaveFocus();
  expect(savingsLink).toHaveAttribute('aria-current', 'true');
  expect(screen.getByRole('link', { name: 'Wallet' })).not.toHaveAttribute('aria-current');
  expect(screen.getByRole('link', { name: 'Intesa credit' })).not.toHaveAttribute('aria-current');
});

test('moves the selection from the selected row with the arrow keys while the focus is outside the list', async () => {
  // arrange
  const user = userEvent.setup();
  render(
    <AccountGroups
      accounts={[wallet, savings, intesaCredit]}
      classifications={undefined}
      topAccountId={undefined}
      baseCurrency="USD"
      listSearchParams={new URLSearchParams()}
      isParamIgnored={false}
    />,
    { initialEntries: [`/?account=${savings.id}`] },
  );

  // act
  await user.keyboard('{ArrowDown}');

  // assert
  const intesaLink = screen.getByRole('link', { name: 'Intesa credit' });
  expect(intesaLink).toHaveFocus();
  expect(intesaLink).toHaveAttribute('aria-current', 'true');
});

test.each([
  // the top row shows its details by default, so Down goes on from it
  { topAccountId: savings.id, nextAccountName: 'Intesa credit' },
  // without a row shown by default Down starts at the first row
  { topAccountId: undefined, nextAccountName: 'Wallet' },
])(
  'moves the selection on from the row shown by default ($topAccountId) while none is selected or focused',
  async ({ topAccountId, nextAccountName }) => {
    // arrange
    const user = userEvent.setup();
    render(
      <AccountGroups
        accounts={[wallet, savings, intesaCredit]}
        classifications={undefined}
        topAccountId={topAccountId}
        baseCurrency="USD"
        listSearchParams={new URLSearchParams()}
        isParamIgnored={false}
      />,
    );

    // act
    await user.keyboard('{ArrowDown}');

    // assert
    const nextLink = screen.getByRole('link', { name: nextAccountName });
    expect(nextLink).toHaveFocus();
    expect(nextLink).toHaveAttribute('aria-current', 'true');
  },
);

test.each(['Shift', 'Control', 'Alt', 'Meta'])(
  'keeps the selection on Up at the first row and on Down with %s held',
  async (modifier) => {
    // arrange
    const user = userEvent.setup();
    render(
      <AccountGroups
        accounts={[wallet, savings]}
        classifications={undefined}
        topAccountId={undefined}
        baseCurrency="USD"
        listSearchParams={new URLSearchParams()}
        isParamIgnored={false}
      />,
    );
    await user.tab();

    // act
    await user.keyboard(`{ArrowUp}{${modifier}>}{ArrowDown}{/${modifier}}`);

    // assert
    expect(screen.getByRole('link', { name: 'Wallet' })).toHaveFocus();
    expect(screen.queryByRole('link', { current: true })).not.toBeInTheDocument();
  },
);
