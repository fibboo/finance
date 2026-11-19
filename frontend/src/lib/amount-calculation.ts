import { PLAIN_BALANCE_PATTERN } from './amount-input';
import { AMOUNT_DECIMAL_DIGITS } from './format-money';

export const CALCULATION_MAX_LENGTH = 256;
const INCOMPLETE_CALCULATION = 'Finish the calculation';
const INVALID_CALCULATION = 'Check the calculation';
const NUMBER_PATTERN = /^(?:\d+(?:[.,]\d*)?|[.,]\d+)$/;
const PRECEDENCE: Readonly<Record<string, number>> = {
  '+': 1,
  '-': 1,
  '*': 2,
  '/': 2,
  negate: 3,
  positive: 3,
};

type Fraction = Readonly<{ numerator: bigint; denominator: bigint }>;
export type AmountCalculation =
  | Readonly<{ status: 'incomplete' }>
  | Readonly<{ status: 'error'; message: string }>
  | Readonly<{ status: 'success'; amount: string }>;

function readPostfix(expression: string): readonly string[] {
  const tokens = expression.match(/\d+(?:[.,]\d*)?|[.,]\d+|\S/g) ?? [];
  const postfix: string[] = [];
  const operators: string[] = [];
  let isOperandExpected = true;
  for (const [index, token] of tokens.entries()) {
    if (NUMBER_PATTERN.test(token)) {
      if (!isOperandExpected) throw new Error(INVALID_CALCULATION);
      postfix.push(token);
      isOperandExpected = false;
    } else if (
      (token === '.' || token === ',') &&
      isOperandExpected &&
      index === tokens.length - 1
    ) {
      throw new Error(INCOMPLETE_CALCULATION);
    } else if (token === '(') {
      if (!isOperandExpected) throw new Error(INVALID_CALCULATION);
      operators.push(token);
    } else if (token === ')') {
      if (isOperandExpected || !operators.includes('(')) throw new Error(INVALID_CALCULATION);
      while (operators.length > 0) {
        const operator = operators.pop();
        if (operator === '(') break;
        if (operator !== undefined) postfix.push(operator);
      }
      isOperandExpected = false;
    } else if (isOperandExpected && (token === '+' || token === '-' || token === '−')) {
      operators.push(token === '+' ? 'positive' : 'negate');
    } else {
      const operator = token === '×' ? '*' : token === '÷' ? '/' : token === '−' ? '-' : token;
      const precedence = PRECEDENCE[operator];
      if (isOperandExpected || precedence === undefined) throw new Error(INVALID_CALCULATION);
      while ((PRECEDENCE[operators.at(-1) ?? ''] ?? 0) >= precedence) {
        const previous = operators.pop();
        if (previous !== undefined) postfix.push(previous);
      }
      operators.push(operator);
      isOperandExpected = true;
    }
  }
  if (isOperandExpected || operators.includes('(')) throw new Error(INCOMPLETE_CALCULATION);
  postfix.push(...operators.reverse());
  return postfix;
}

function readFraction(postfix: readonly string[]): Fraction {
  const fractions: Fraction[] = [];
  for (const token of postfix) {
    if (NUMBER_PATTERN.test(token)) {
      const [integer = '', fraction = ''] = token.replace(',', '.').split('.');
      fractions.push({
        numerator: BigInt(`${integer}${fraction}`),
        denominator: 10n ** BigInt(fraction.length),
      });
      continue;
    }

    const right = fractions.pop();
    if (right === undefined) throw new Error(INVALID_CALCULATION);
    if (token === 'negate' || token === 'positive') {
      fractions.push({
        ...right,
        numerator: token === 'negate' ? -right.numerator : right.numerator,
      });
      continue;
    }

    const left = fractions.pop();
    if (left === undefined) throw new Error(INVALID_CALCULATION);
    switch (token) {
      case '+':
      case '-':
        fractions.push({
          numerator:
            left.numerator * right.denominator +
            (token === '+' ? 1n : -1n) * right.numerator * left.denominator,
          denominator: left.denominator * right.denominator,
        });
        break;
      case '*':
        fractions.push({
          numerator: left.numerator * right.numerator,
          denominator: left.denominator * right.denominator,
        });
        break;
      case '/':
        if (right.numerator === 0n) throw new Error('Cannot divide by zero');
        fractions.push({
          numerator: left.numerator * right.denominator,
          denominator: left.denominator * right.numerator,
        });
        break;
      default:
        throw new Error(INVALID_CALCULATION);
    }
  }

  const fraction = fractions[0];
  if (fractions.length !== 1 || fraction === undefined) throw new Error(INVALID_CALCULATION);
  return fraction;
}

function roundAmount({ numerator, denominator }: Fraction): string {
  const isNegative = numerator !== 0n && numerator < 0n !== denominator < 0n;
  const magnitude = numerator < 0n ? -numerator : numerator;
  const divisor = denominator < 0n ? -denominator : denominator;
  const scale = 10n ** BigInt(AMOUNT_DECIMAL_DIGITS);
  const scaled = magnitude * scale;
  const rounded = scaled / divisor + ((scaled % divisor) * 2n >= divisor ? 1n : 0n);
  const sign = isNegative && rounded !== 0n ? '-' : '';
  const amount = `${sign}${String(rounded / scale)}.${String(rounded % scale).padStart(AMOUNT_DECIMAL_DIGITS, '0')}`;
  return amount;
}

export function calculateAmount({
  expression,
  isNegativeAllowed,
}: Readonly<{ expression: string; isNegativeAllowed: boolean }>): AmountCalculation {
  if (expression.length > CALCULATION_MAX_LENGTH)
    return { status: 'error', message: `Use at most ${String(CALCULATION_MAX_LENGTH)} characters` };
  try {
    const postfix = readPostfix(expression);
    const fraction = readFraction(postfix);
    const amount = roundAmount(fraction);
    if (!PLAIN_BALANCE_PATTERN.test(amount))
      return { status: 'error', message: 'The result is too large' };
    if (amount === '0.00') return { status: 'error', message: 'Enter an amount other than zero' };
    if (!isNegativeAllowed && amount.startsWith('-'))
      return { status: 'error', message: 'Enter an amount over zero' };
    return { status: 'success', amount };
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    const calculation: AmountCalculation =
      error.message === INCOMPLETE_CALCULATION
        ? { status: 'incomplete' }
        : { status: 'error', message: error.message };
    return calculation;
  }
}
