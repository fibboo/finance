import { expect, test } from 'vitest';

import {
  editAmountText,
  formatAmountText,
  readPlainAmount,
  readSubmittedAmount,
} from './amount-input';

test.each([
  { change: 'a letter', previousText: '12', text: '12a', caret: 3, isNegativeAllowed: false },
  {
    change: 'a second point',
    previousText: '1.5',
    text: '1.5.',
    caret: 4,
    isNegativeAllowed: false,
  },
  {
    change: 'a minus of an amount',
    previousText: '',
    text: '-',
    caret: 1,
    isNegativeAllowed: false,
  },
  {
    change: 'a minus after a digit',
    previousText: '5',
    text: '5-',
    caret: 2,
    isNegativeAllowed: true,
  },
])('refuses $change', ({ previousText, text, caret, isNegativeAllowed }) => {
  // act
  const editedText = editAmountText({
    previousText,
    text,
    caret,
    isForwardDelete: false,
    isNegativeAllowed,
  });

  // assert
  expect(editedText).toBeUndefined();
});

test.each([
  {
    change: 'a typed comma',
    previousText: '1,234',
    text: '1,234,',
    caret: 6,
    isForwardDelete: false,
    isNegativeAllowed: false,
    edited: { text: '1,234.', caret: 6 },
  },
  {
    change: 'a fourth integer digit',
    previousText: '123',
    text: '1234',
    caret: 4,
    isForwardDelete: false,
    isNegativeAllowed: false,
    edited: { text: '1,234', caret: 5 },
  },
  {
    change: 'a digit typed in the middle',
    previousText: '1,234',
    text: '1,2534',
    caret: 4,
    isForwardDelete: false,
    isNegativeAllowed: false,
    edited: { text: '12,534', caret: 4 },
  },
  {
    change: 'a pasted grouped amount',
    previousText: '',
    text: '1,234,567.8',
    caret: 11,
    isForwardDelete: false,
    isNegativeAllowed: false,
    edited: { text: '1,234,567.8', caret: 11 },
  },
  {
    change: 'a pasted amount with a decimal comma',
    previousText: '',
    text: '12,5',
    caret: 4,
    isForwardDelete: false,
    isNegativeAllowed: false,
    edited: { text: '12.5', caret: 4 },
  },
  {
    change: 'a leading minus of a balance',
    previousText: '',
    text: '-',
    caret: 1,
    isForwardDelete: false,
    isNegativeAllowed: true,
    edited: { text: '-', caret: 1 },
  },
  {
    change: 'a separator deleted backwards',
    previousText: '1,234',
    text: '1234',
    caret: 1,
    isForwardDelete: false,
    isNegativeAllowed: false,
    edited: { text: '234', caret: 0 },
  },
  {
    change: 'a separator deleted forwards',
    previousText: '1,234',
    text: '1234',
    caret: 1,
    isForwardDelete: true,
    isNegativeAllowed: false,
    edited: { text: '134', caret: 1 },
  },
  {
    change: 'a digit after a zero',
    previousText: '0',
    text: '05',
    caret: 2,
    isForwardDelete: false,
    isNegativeAllowed: false,
    edited: { text: '5', caret: 1 },
  },
  {
    change: 'a digit after zeros of a balance',
    previousText: '-00',
    text: '-001',
    caret: 4,
    isForwardDelete: false,
    isNegativeAllowed: true,
    edited: { text: '-1', caret: 2 },
  },
  {
    change: 'a point after a zero',
    previousText: '0',
    text: '0.',
    caret: 2,
    isForwardDelete: false,
    isNegativeAllowed: false,
    edited: { text: '0.', caret: 2 },
  },
  {
    change: 'a deleted digit',
    previousText: '1,234',
    text: '1,23',
    caret: 4,
    isForwardDelete: false,
    isNegativeAllowed: false,
    edited: { text: '123', caret: 3 },
  },
])(
  'accepts $change and groups the digits',
  ({ previousText, text, caret, isForwardDelete, isNegativeAllowed, edited }) => {
    // act
    const editedText = editAmountText({
      previousText,
      text,
      caret,
      isForwardDelete,
      isNegativeAllowed,
    });

    // assert
    expect(editedText).toEqual(edited);
  },
);

test.each([
  { plainAmount: '', text: '' },
  { plainAmount: '-', text: '-' },
  { plainAmount: '1234567', text: '1,234,567.00' },
  { plainAmount: '1234.5', text: '1,234.50' },
  { plainAmount: '.5', text: '0.50' },
  { plainAmount: '-1234.', text: '-1,234.00' },
])('formats $plainAmount as $text', ({ plainAmount, text }) => {
  // act
  const amountText = formatAmountText(plainAmount);

  // assert
  expect(amountText).toBe(text);
});

test.each([
  { text: ' 1,234,567.89 ', plainAmount: '1234567.89' },
  { text: '-1,234', plainAmount: '-1234' },
])('reads $text as the plain amount $plainAmount', ({ text, plainAmount }) => {
  // act
  const amount = readPlainAmount(text);

  // assert
  expect(amount).toBe(plainAmount);
});

test.each([
  {
    digits: '13 integer digits of an amount',
    previousText: '123,456,789,012',
    text: '123,456,789,0123',
    caret: 16,
    isNegativeAllowed: false,
    edited: { text: '1,234,567,890,123', caret: 17 },
  },
  {
    digits: '14 integer digits of an amount',
    previousText: '1,234,567,890,123',
    text: '1,234,567,890,1234',
    caret: 18,
    isNegativeAllowed: false,
    edited: undefined,
  },
  {
    digits: '13 integer digits of a balance',
    previousText: '-123,456,789,012',
    text: '-123,456,789,0123',
    caret: 17,
    isNegativeAllowed: true,
    edited: { text: '-1,234,567,890,123', caret: 18 },
  },
  {
    digits: '14 integer digits of a balance',
    previousText: '-1,234,567,890,123',
    text: '-1,234,567,890,1234',
    caret: 19,
    isNegativeAllowed: true,
    edited: undefined,
  },
  {
    digits: '2 decimals',
    previousText: '1.2',
    text: '1.25',
    caret: 4,
    isNegativeAllowed: false,
    edited: { text: '1.25', caret: 4 },
  },
  {
    digits: '3 decimals',
    previousText: '1.25',
    text: '1.255',
    caret: 5,
    isNegativeAllowed: false,
    edited: undefined,
  },
])(
  'gives $digits the result $edited',
  ({ previousText, text, caret, isNegativeAllowed, edited }) => {
    // act
    const editedText = editAmountText({
      previousText,
      text,
      caret,
      isForwardDelete: false,
      isNegativeAllowed,
    });

    // assert
    expect(editedText).toEqual(edited);
  },
);

test.each([
  { text: '', submittedAmount: '' },
  { text: '250.', submittedAmount: '250.00' },
  { text: '.5', submittedAmount: '0.50' },
  { text: '-12.', submittedAmount: '-12.00' },
  { text: '1,234.5', submittedAmount: '1234.50' },
])('submits $text as $submittedAmount', ({ text, submittedAmount }) => {
  // act
  const amount = readSubmittedAmount(text);

  // assert
  expect(amount).toBe(submittedAmount);
});
