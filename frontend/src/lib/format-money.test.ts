import { expect, test } from 'vitest';

import { formatMoney } from './format-money';

test.each([
  { currency: 'RSD', amount: 204929.17, money: 'RSD 204,929.17' },
  { currency: 'RSD', amount: 204929, money: 'RSD 204,929.00' },
  { currency: 'JPY', amount: 204929.17, money: '¥204,929.17' },
  { currency: 'KWD', amount: 204929.17, money: 'KWD 204,929.17' },
  { currency: 'USD', amount: 204929.17, money: '$204,929.17' },
])('shows $amount $currency with two decimals', ({ currency, amount, money }) => {
  // act
  const formattedMoney = formatMoney({ amount, currency });

  // assert
  expect(formattedMoney).toBe(money);
});

test.each([
  { amount: 204929, money: 'RSD 204,929' },
  { amount: 204929.1, money: 'RSD 204,929.10' },
])('drops the zeros of a whole amount only: $amount', ({ amount, money }) => {
  // act
  const formattedMoney = formatMoney({
    amount,
    currency: 'RSD',
    trailingZeroDisplay: 'stripIfInteger',
  });

  // assert
  expect(formattedMoney).toBe(money);
});
