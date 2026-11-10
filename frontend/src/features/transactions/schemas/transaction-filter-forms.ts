import { z } from 'zod';

import { PLAIN_AMOUNT_PATTERN, readSubmittedAmount } from '@/lib/amount-input';
import { transactionTypeValues } from '@/lib/api-schema';
import { DATE_TEXT_PLACEHOLDER, readIsoDate } from '@/lib/format-date';

const AMOUNT_ERROR = 'Enter an amount such as 100 or 99.50.';

const optionalAmount = z
  .string()
  .overwrite((amount) => readSubmittedAmount(amount))
  .regex(new RegExp(`^$|${PLAIN_AMOUNT_PATTERN.source}`), AMOUNT_ERROR)
  .transform((amount) => (amount === '' ? undefined : amount))
  .refine((amount) => amount === undefined || Number(amount) > 0, 'Enter an amount over zero.');

const DATE_ERROR = `Enter a date as ${DATE_TEXT_PLACEHOLDER}.`;
const FUTURE_DATE_ERROR = 'Pick a date no later than today.';

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

export const accountFilterFormSchema = z.object({
  account_ids: z.array(z.string()),
});
