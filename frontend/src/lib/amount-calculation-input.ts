import {
  type EditedAmountText,
  groupPlainAmount,
  readCommonPrefixLength,
  readGroupedCaret,
  readPlainAmount,
  readPlainInsertedText,
  removeDigitBesideCaret,
} from './amount-input';

const CALCULATION_CHARACTERS = /^[\d.,+*/()×÷−\s-]*$/u;
const DRAFT_NUMBER = /^\d*(?:\.\d*)?$/;

export function readPlainCalculation(expression: string): string {
  const plainExpression = expression.replace(/[\d.,]+/g, (number) => readPlainAmount(number));
  return plainExpression;
}

export function formatCalculation(expression: string): string {
  const formattedExpression = expression.replace(/[\d.]+/g, (number) =>
    DRAFT_NUMBER.test(number) ? groupPlainAmount(number) : number,
  );
  return formattedExpression;
}

export function pasteCalculationText({
  expression,
  insertedText,
  start,
  end,
}: Readonly<{ expression: string; insertedText: string; start: number; end: number }>):
  EditedAmountText | undefined {
  if (!CALCULATION_CHARACTERS.test(insertedText)) return undefined;
  const prefix = readPlainCalculation(expression.slice(0, start));
  const inserted = insertedText.replace(/[\d.,]+/g, (number) => readPlainInsertedText(number));
  const plainText = `${prefix}${inserted}${readPlainCalculation(expression.slice(end))}`;
  const text = formatCalculation(plainText);
  const change = {
    text,
    caret: readGroupedCaret({ groupedText: text, plainCaret: prefix.length + inserted.length }),
  };
  return change;
}

export function editCalculationText({
  previousText,
  text,
  caret,
  isForwardDelete,
}: Readonly<{ previousText: string; text: string; caret: number; isForwardDelete: boolean }>):
  EditedAmountText | undefined {
  if (!CALCULATION_CHARACTERS.test(text)) return undefined;
  const prefixLength = readCommonPrefixLength({ previousText, text, caret });
  const prefix = readPlainCalculation(text.slice(0, prefixLength));
  const inserted = text
    .slice(prefixLength, caret)
    .replace(/[\d.,]+/g, (number) => readPlainInsertedText(number));
  const plainText = `${prefix}${inserted}${readPlainCalculation(text.slice(caret))}`;
  const plainCaret = prefix.length + inserted.length;
  const isSeparatorDeleted =
    text.length < previousText.length && plainText === readPlainCalculation(previousText);
  const edited = isSeparatorDeleted
    ? removeDigitBesideCaret({ plainText, plainCaret, isForwardDelete })
    : { plainText, plainCaret };
  const groupedText = formatCalculation(edited.plainText);
  const change = {
    text: groupedText,
    caret: readGroupedCaret({ groupedText, plainCaret: edited.plainCaret }),
  };
  return change;
}
