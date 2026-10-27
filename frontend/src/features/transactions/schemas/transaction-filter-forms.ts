import { z } from 'zod';

import { transactionTypeValues } from '@/lib/api-schema';

import { AMOUNT_PATTERN } from '../api/transaction-filters';

const AMOUNT_ERROR = 'Enter an amount such as 100 or 99.50.';

const optionalAmount = z
  .string()
  .trim()
  .regex(new RegExp(`^$|${AMOUNT_PATTERN.source}`), AMOUNT_ERROR)
  .transform((amount) => (amount === '' ? undefined : amount))
  .refine((amount) => amount === undefined || Number(amount) > 0, 'Enter an amount over zero.');

const DATE_TEXT_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const DATE_TEXT_DIGIT_COUNT = 8;
const DATE_ERROR = 'Enter a date as mm/dd/yyyy.';
const FUTURE_DATE_ERROR = 'Pick a date no later than today.';

export function readIsoDate(dateText: string): string | undefined {
  const match = DATE_TEXT_PATTERN.exec(dateText.trim());
  if (match === null) {
    return undefined;
  }

  const [, month, day, year] = match;
  const isoDate = `${year ?? ''}-${month ?? ''}-${day ?? ''}`;
  const date = new Date(`${isoDate}T00:00:00Z`);
  const isRealDate = !Number.isNaN(date.getTime()) && date.toISOString().startsWith(isoDate);
  return isRealDate ? isoDate : undefined;
}

export function toDateText(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  const dateText = `${month ?? ''}/${day ?? ''}/${year ?? ''}`;
  return dateText;
}

export function maskDateText(typedText: string): string {
  const digits = typedText.replace(/\D/g, '').slice(0, DATE_TEXT_DIGIT_COUNT);
  const dateText = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)]
    .filter((part) => part !== '')
    .join('/');
  return dateText;
}

export function createPeriodFilterFormSchema(today: string) {
  const optionalDate = z
    .string()
    .trim()
    .refine((dateText) => dateText === '' || readIsoDate(dateText) !== undefined, DATE_ERROR)
    .transform((dateText) => (dateText === '' ? '' : (readIsoDate(dateText) ?? '')))
    .refine((isoDate) => isoDate === '' || isoDate <= today, FUTURE_DATE_ERROR);
  const periodFilterFormSchema = z
    .object({
      date_from: optionalDate,
      date_to: optionalDate.optional(),
    })
    .refine(
      ({ date_from, date_to }) =>
        date_from === '' || date_to === undefined || date_to === '' || date_from <= date_to,
      {
        message: 'Pick a start no later than the end.',
        path: ['date_from'],
      },
    );
  return periodFilterFormSchema;
}

export const typeFilterFormSchema = z.object({
  transaction_types: z.array(z.enum(transactionTypeValues)),
});

export const amountFilterFormSchema = z
  .object({
    base_currency_amount_from: optionalAmount,
    base_currency_amount_to: optionalAmount,
  })
  .refine(
    ({ base_currency_amount_from: from, base_currency_amount_to: to }) =>
      from === undefined || to === undefined || Number(from) <= Number(to),
    {
      message: 'Enter a lower bound no higher than the upper.',
      path: ['base_currency_amount_from'],
    },
  );
