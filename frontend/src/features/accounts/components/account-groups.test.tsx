import { screen, within } from '@testing-library/react';
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
  category_type: null,
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

const creditCard = {
  ...wallet,
  name: 'Credit card',
  id: '8c1a7f0c-2f4e-4b9e-9d1f-0e6a3c2b1a04',
  kind: 'LIABILITY',
  balance: '-318.40',
  color: '#C2613F',
  base_currency_balance: '-318.40',
} satisfies components['schemas']['Account'];

const intesaCredit = {
  ...wallet,
  name: 'Intesa credit',
  id: '8c1a7f0c-2f4e-4b9e-9d1f-0e6a3c2b1a05',
  kind: 'LIABILITY',
  balance: '-1240.00',
  currency: 'EUR',
  color: '#8A6FD1',
  base_currency_rate: '0.8545',
  base_currency_balance: '-1451.20',
} satisfies components['schemas']['Account'];

test('groups assets before liabilities, each with its total and the largest amount first', () => {
  // act
  render(
    <AccountGroups accounts={[wallet, creditCard, mainCard, intesaCredit]} baseCurrency="USD" />,
  );

  // assert
  const groups = screen.getAllByRole('region');
  expect(groups).toHaveLength(2);
  const [assets, liabilities] = groups;
  if (assets === undefined || liabilities === undefined) {
    throw new Error('Both groups must be shown.');
  }
  expect(within(assets).getByRole('heading', { name: 'Assets' })).toBeInTheDocument();
  expect(assets).toHaveTextContent('$3,883.70');
  const assetRows = within(assets).getAllByRole('listitem');
  expect(assetRows[0]).toHaveTextContent('Main cardEUR$3,471.20€3,180.00');
  expect(assetRows[1]).toHaveTextContent('WalletUSD$412.50');
  expect(assetRows[1]).not.toHaveTextContent('$412.50$412.50');
  expect(within(liabilities).getByRole('heading', { name: 'Liabilities' })).toBeInTheDocument();
  expect(liabilities).toHaveTextContent('-$1,769.60');
  const liabilityRows = within(liabilities).getAllByRole('listitem');
  expect(liabilityRows[0]).toHaveTextContent('Intesa credit');
  expect(liabilityRows[1]).toHaveTextContent('Credit card');
});

test('leaves out a group without accounts', () => {
  // act
  render(<AccountGroups accounts={[wallet]} baseCurrency="USD" />);

  // assert
  expect(screen.getByRole('region', { name: 'Assets' })).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Liabilities' })).not.toBeInTheDocument();
});

test('shows the groups as loading while the accounts are pending', () => {
  // act
  render(<AccountGroups accounts={undefined} baseCurrency="USD" />);

  // assert
  expect(screen.queryByRole('region')).not.toBeInTheDocument();
  expect(screen.getAllByRole('listitem')).toHaveLength(3);
});
