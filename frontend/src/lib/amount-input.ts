import { LOCALE } from './format-money';

const AMOUNT_INTEGER_DIGITS = String(13);
const AMOUNT_DECIMAL_DIGITS = 2;
const GROUP_SIZE = 3;
const PLAIN_DECIMAL_SEPARATOR = '.';
const SEPARATOR_PARTS = new Intl.NumberFormat(LOCALE).formatToParts(1000.5);
const REGEX_SPECIAL_CHARACTER_PATTERN = /[.*+?^${}()|[\]\\]/g;
const TYPED_DECIMAL_SEPARATOR_PATTERN = /[.,]/g;
const WHITESPACE_PATTERN = /\s/g;

function readSeparator(type: 'group' | 'decimal'): string {
  const separator = SEPARATOR_PARTS.find((part) => part.type === type)?.value;
  if (separator === undefined) {
    throw new Error(`The locale ${LOCALE} has no ${type} separator.`);
  }

  return separator;
}

function escapeForPattern(text: string): string {
  const escapedText = text.replace(REGEX_SPECIAL_CHARACTER_PATTERN, '\\$&');
  return escapedText;
}

const GROUP_SEPARATOR = readSeparator('group');
const DECIMAL_SEPARATOR = readSeparator('decimal');

const UNSIGNED_DRAFT_PATTERN = new RegExp(
  `^\\d{0,${AMOUNT_INTEGER_DIGITS}}(\\.\\d{0,${String(AMOUNT_DECIMAL_DIGITS)}})?$`,
);
const SIGNED_DRAFT_PATTERN = new RegExp(
  `^-?\\d{0,${AMOUNT_INTEGER_DIGITS}}(\\.\\d{0,${String(AMOUNT_DECIMAL_DIGITS)}})?$`,
);
const GROUPED_PASTE_PATTERN = new RegExp(
  `^-?\\d{1,3}(${escapeForPattern(GROUP_SEPARATOR)}\\d{3})+(${escapeForPattern(DECIMAL_SEPARATOR)}\\d*)?$`,
);

export const PLAIN_AMOUNT_PATTERN = new RegExp(
  `^\\d{1,${AMOUNT_INTEGER_DIGITS}}(\\.\\d{1,${String(AMOUNT_DECIMAL_DIGITS)}})?$`,
);
export const PLAIN_BALANCE_PATTERN = new RegExp(
  `^-?\\d{1,${AMOUNT_INTEGER_DIGITS}}(\\.\\d{1,${String(AMOUNT_DECIMAL_DIGITS)}})?$`,
);

export type EditedAmountText = Readonly<{ text: string; caret: number }>;

export function readPlainAmount(amountText: string): string {
  const plainAmount = amountText
    .trim()
    .replaceAll(GROUP_SEPARATOR, '')
    .replaceAll(DECIMAL_SEPARATOR, PLAIN_DECIMAL_SEPARATOR);
  return plainAmount;
}

function readPlainInsertedText(insertedText: string): string {
  const compactText = insertedText.replace(WHITESPACE_PATTERN, '');
  const plainText = GROUPED_PASTE_PATTERN.test(compactText)
    ? readPlainAmount(compactText)
    : compactText.replace(TYPED_DECIMAL_SEPARATOR_PATTERN, PLAIN_DECIMAL_SEPARATOR);
  return plainText;
}

function groupPlainAmount(plainAmount: string): string {
  const sign = plainAmount.startsWith('-') ? '-' : '';
  const [integerDigits = '', fractionDigits] = plainAmount.slice(sign.length).split('.');
  const groups: string[] = [];
  for (let end = integerDigits.length; end > 0; end -= GROUP_SIZE) {
    groups.unshift(integerDigits.slice(Math.max(0, end - GROUP_SIZE), end));
  }

  const fraction = fractionDigits === undefined ? '' : `${DECIMAL_SEPARATOR}${fractionDigits}`;
  const groupedAmount = `${sign}${groups.join(GROUP_SEPARATOR)}${fraction}`;
  return groupedAmount;
}

function readCommonPrefixLength({
  previousText,
  text,
  caret,
}: Readonly<{ previousText: string; text: string; caret: number }>): number {
  const limit = Math.min(caret, previousText.length - (text.length - caret));
  let length = 0;
  while (length < limit && previousText[length] === text[length]) {
    length += 1;
  }

  return length;
}

function readGroupedCaret({
  groupedText,
  plainCaret,
}: Readonly<{ groupedText: string; plainCaret: number }>): number {
  let plainCount = 0;
  let caret = 0;
  while (plainCount < plainCaret && caret < groupedText.length) {
    if (groupedText[caret] !== GROUP_SEPARATOR) {
      plainCount += 1;
    }

    caret += 1;
  }

  return caret;
}

function removeDigitBesideCaret({
  plainText,
  plainCaret,
  isForwardDelete,
}: Readonly<{ plainText: string; plainCaret: number; isForwardDelete: boolean }>): Readonly<{
  plainText: string;
  plainCaret: number;
}> {
  const removedIndex = isForwardDelete ? plainCaret : plainCaret - 1;
  if (removedIndex < 0 || removedIndex >= plainText.length) {
    return { plainText, plainCaret };
  }

  const editedText = {
    plainText: `${plainText.slice(0, removedIndex)}${plainText.slice(removedIndex + 1)}`,
    plainCaret: removedIndex,
  };
  return editedText;
}

export function editAmountText({
  previousText,
  text,
  caret,
  isForwardDelete,
  isNegativeAllowed,
}: Readonly<{
  previousText: string;
  text: string;
  caret: number;
  isForwardDelete: boolean;
  isNegativeAllowed: boolean;
}>): EditedAmountText | undefined {
  const prefixLength = readCommonPrefixLength({ previousText, text, caret });
  const plainPrefix = readPlainAmount(text.slice(0, prefixLength));
  const plainInserted = readPlainInsertedText(text.slice(prefixLength, caret));
  const typedText = {
    plainText: `${plainPrefix}${plainInserted}${readPlainAmount(text.slice(caret))}`,
    plainCaret: plainPrefix.length + plainInserted.length,
  };
  const isOnlySeparatorDeleted =
    text.length < previousText.length && typedText.plainText === readPlainAmount(previousText);
  const { plainText, plainCaret } = isOnlySeparatorDeleted
    ? removeDigitBesideCaret({ ...typedText, isForwardDelete })
    : typedText;
  const draftPattern = isNegativeAllowed ? SIGNED_DRAFT_PATTERN : UNSIGNED_DRAFT_PATTERN;
  if (!draftPattern.test(plainText)) {
    return undefined;
  }

  const groupedText = groupPlainAmount(plainText);
  const editedAmountText = {
    text: groupedText,
    caret: readGroupedCaret({ groupedText, plainCaret }),
  };
  return editedAmountText;
}

export function formatAmountText(plainAmount: string): string {
  const sign = plainAmount.startsWith('-') ? '-' : '';
  const [integerDigits = '', fractionDigits = ''] = plainAmount.slice(sign.length).split('.');
  if (integerDigits === '' && fractionDigits === '') {
    return plainAmount;
  }

  const integerPart = integerDigits === '' ? '0' : integerDigits;
  const paddedAmount = groupPlainAmount(
    `${sign}${integerPart}.${fractionDigits.padEnd(AMOUNT_DECIMAL_DIGITS, '0')}`,
  );
  return paddedAmount;
}
