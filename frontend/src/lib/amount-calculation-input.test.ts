import { expect, test } from 'vitest';

import { calculateAmount } from './amount-calculation';
import {
  editCalculationText,
  formatCalculation,
  readPlainCalculation,
} from './amount-calculation-input';

test.each([
  {
    previousText: '123',
    text: '1234',
    caret: 4,
    isForwardDelete: false,
    expected: { text: '1,234', caret: 5 },
  },
  {
    previousText: '1,234',
    text: '1,234,',
    caret: 6,
    isForwardDelete: false,
    expected: { text: '1,234.', caret: 6 },
  },
  {
    previousText: '1,234+5',
    text: '1,234+56',
    caret: 8,
    isForwardDelete: false,
    expected: { text: '1,234+56', caret: 8 },
  },
  {
    previousText: '1,234+5',
    text: '1234+5',
    caret: 1,
    isForwardDelete: false,
    expected: { text: '234+5', caret: 0 },
  },
  {
    previousText: '1,234+5',
    text: '1234+5',
    caret: 1,
    isForwardDelete: true,
    expected: { text: '134+5', caret: 1 },
  },
  {
    previousText: '1,234',
    text: '1,2534',
    caret: 4,
    isForwardDelete: false,
    expected: { text: '12,534', caret: 4 },
  },
  {
    previousText: '',
    text: '(1234,5 + 2000) / 0.125',
    caret: 23,
    isForwardDelete: false,
    expected: { text: '(1,234.5 + 2,000) / 0.125', caret: 25 },
  },
])('formats $text at caret $caret', ({ previousText, text, caret, isForwardDelete, expected }) => {
  const change = editCalculationText({ previousText, text, caret, isForwardDelete });
  expect(change).toEqual(expected);
});

test.each(['1a', '2%', '2^3', '5@2', 'NaN', '１２', '1;2'])(
  'rejects disallowed characters in %s',
  (text) => {
    const change = editCalculationText({
      previousText: '1',
      text,
      caret: text.length,
      isForwardDelete: false,
    });
    expect(change).toBeUndefined();
  },
);

test('pastes grouped operands without changing their decimal values', () => {
  const pasted = '1,234.56 + 2,000.44';
  const change = editCalculationText({
    previousText: '',
    text: pasted,
    caret: pasted.length,
    isForwardDelete: false,
  });
  expect(change?.text).toBe(pasted);
  const expression = readPlainCalculation(change?.text ?? '');
  expect(calculateAmount({ expression, isNegativeAllowed: false })).toEqual({
    status: 'success',
    amount: '3235.00',
  });
});

test('keeps malformed decimal drafts visible for validation', () => {
  const expression = formatCalculation('1234..5 + 1000');
  expect(expression).toBe('1234..5 + 1,000');
  expect(
    calculateAmount({ expression: readPlainCalculation(expression), isNegativeAllowed: false }),
  ).toEqual({ status: 'error', message: 'Check the calculation' });
});
