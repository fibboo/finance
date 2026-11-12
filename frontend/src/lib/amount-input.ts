import { AMOUNT_DECIMAL_DIGITS, LOCALE } from './format-money';

const AMOUNT_INTEGER_DIGITS = 13;
const GROUP_SIZE = 3;
const PLAIN_DECIMAL_SEPARATOR = '.';
const SEPARATOR_PARTS = new Intl.NumberFormat(LOCALE).formatToParts(1000.5);
const REGEX_SPECIAL_CHARACTER_PATTERN = /[.*+?^${}()|[\]\\]/g;
const TYPED_DECIMAL_SEPARATOR_PATTERN = /[.,]/g;
const WHITESPACE_PATTERN = /\s/g;
const LEADING_ZEROS_PATTERN = /^(0+)\d/;

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

function createAmountPattern({
  isSigned,
  isDraft,
}: Readonly<{ isSigned: boolean; isDraft: boolean }>): RegExp {
  const sign = isSigned ? '-?' : '';
  const minimumDigits = isDraft ? 0 : 1;
  const integerDigits = `\\d{${String(minimumDigits)},${String(AMOUNT_INTEGER_DIGITS)}}`;
  const decimalDigits = `\\d{${String(minimumDigits)},${String(AMOUNT_DECIMAL_DIGITS)}}`;
  const amountPattern = new RegExp(`^${sign}${integerDigits}(\\.${decimalDigits})?$`);
  return amountPattern;
}

const GROUP_SEPARATOR = readSeparator('group');
const DECIMAL_SEPARATOR = readSeparator('decimal');

const UNSIGNED_DRAFT_PATTERN = createAmountPattern({ isSigned: false, isDraft: true });
const SIGNED_DRAFT_PATTERN = createAmountPattern({ isSigned: true, isDraft: true });
const GROUPED_PASTE_PATTERN = new RegExp(
  `^-?\\d{1,3}(${escapeForPattern(GROUP_SEPARATOR)}\\d{3})+(${escapeForPattern(DECIMAL_SEPARATOR)}\\d*)?$`,
);

export const PLAIN_AMOUNT_PATTERN = createAmountPattern({ isSigned: false, isDraft: false });
export const PLAIN_BALANCE_PATTERN = createAmountPattern({ isSigned: true, isDraft: false });

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

function dropLeadingZeros({
  plainText,
  plainCaret,
}: Readonly<{ plainText: string; plainCaret: number }>): Readonly<{
  plainText: string;
  plainCaret: number;
}> {
  const sign = plainText.startsWith('-') ? '-' : '';
  const unsignedText = plainText.slice(sign.length);
  const leadingZeros = LEADING_ZEROS_PATTERN.exec(unsignedText)?.[1] ?? '';
  const droppedBeforeCaret = Math.min(leadingZeros.length, Math.max(0, plainCaret - sign.length));
  const editedText = {
    plainText: `${sign}${unsignedText.slice(leadingZeros.length)}`,
    plainCaret: plainCaret - droppedBeforeCaret,
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
  const editedText = isOnlySeparatorDeleted
    ? removeDigitBesideCaret({ ...typedText, isForwardDelete })
    : typedText;
  const { plainText, plainCaret } =
    plainInserted === '' ? editedText : dropLeadingZeros(editedText);
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

function padPlainAmount(plainAmount: string): string {
  const sign = plainAmount.startsWith('-') ? '-' : '';
  const [integerDigits = '', fractionDigits = ''] = plainAmount.slice(sign.length).split('.');
  if (!SIGNED_DRAFT_PATTERN.test(plainAmount) || (integerDigits === '' && fractionDigits === '')) {
    return plainAmount;
  }

  const integerPart = integerDigits === '' ? '0' : integerDigits;
  const paddedAmount = `${sign}${integerPart}.${fractionDigits.padEnd(AMOUNT_DECIMAL_DIGITS, '0')}`;
  return paddedAmount;
}

export function formatAmountText(plainAmount: string): string {
  const amountText = groupPlainAmount(padPlainAmount(plainAmount));
  return amountText;
}

export function readSubmittedAmount(amountText: string): string {
  const submittedAmount = padPlainAmount(readPlainAmount(amountText));
  return submittedAmount;
}
