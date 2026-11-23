import { expect, test } from 'vitest';

import { calculateAmount } from './amount-calculation';

test.each([
  ['2 + 3 * 4', '14.00'],
  ['(2 + 3) * 4', '20.00'],
  ['10 - 3 - 2', '5.00'],
  ['8 / 4 / 2', '1.00'],
  ['-(2 + 3)', '-5.00'],
  ['1--2', '3.00'],
  ['1 / -2', '-0.50'],
  ['--(+2)', '2.00'],
  ['.5 + 1,25', '1.75'],
  ['42.80 + 18.40 − 7.20', '54.00'],
  ['2 × 3 ÷ 4', '1.50'],
  ['0.1 + 0.2', '0.30'],
  ['1 / 3 * 3', '1.00'],
  ['1.005', '1.01'],
  ['-1.005', '-1.01'],
  ['1 / 8', '0.13'],
  ['-1 / 8', '-0.13'],
  ['1 / 3 + 1 / 3 + 1 / 3', '1.00'],
  ['0.005', '0.01'],
  ['2.', '2.00'],
  ['9999999999999.994', '9999999999999.99'],
  ['-9999999999999.994', '-9999999999999.99'],
  [' '.repeat(255) + '1', '1.00'],
  ['9999999999999.99 * 9999999999999.99 / 9999999999999.99', '9999999999999.99'],
])('calculates %s and rounds only the result', (expression, amount) => {
  const calculation = calculateAmount({ expression, isNegativeAllowed: true });
  expect(calculation).toEqual({ status: 'success', amount });
});

test.each(['', ' ', '1 +', '(', '(1 + 2', '-', '1 /', '.', '1 + ,'])(
  'keeps %s unfinished',
  (expression) => {
    const calculation = calculateAmount({ expression, isNegativeAllowed: false });
    expect(calculation).toEqual({ status: 'incomplete' });
  },
);

test.each([
  '1e3',
  '2(3)',
  '()',
  '1 2',
  '1,2.3',
  '2**3',
  'Infinity',
  'NaN',
  '1+)',
  '10%',
  'alert(1)',
])('refuses %s', (expression) => {
  const calculation = calculateAmount({ expression, isNegativeAllowed: true });
  expect(calculation).toEqual({ status: 'error', message: 'Check the calculation' });
});

test.each([
  { expression: '1 / (2 - 2)', isNegativeAllowed: true, message: 'Cannot divide by zero' },
  { expression: '9999999999999.995', isNegativeAllowed: true, message: 'The result is too large' },
  { expression: '-9999999999999.995', isNegativeAllowed: true, message: 'The result is too large' },
  { expression: '1 - 2', isNegativeAllowed: false, message: 'Enter an amount over zero' },
  { expression: '1 - 1', isNegativeAllowed: true, message: 'Enter an amount other than zero' },
  { expression: '-0.004', isNegativeAllowed: true, message: 'Enter an amount other than zero' },
  { expression: '1'.repeat(257), isNegativeAllowed: true, message: 'Use at most 256 characters' },
])('reports $message for $expression', ({ expression, isNegativeAllowed, message }) => {
  const calculation = calculateAmount({ expression, isNegativeAllowed });
  expect(calculation).toEqual({ status: 'error', message });
});
