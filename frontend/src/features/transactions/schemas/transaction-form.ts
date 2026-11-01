import { z } from 'zod';

import type { components } from '@/lib/api-schema';
import { DATE_TEXT_PLACEHOLDER, readIsoDate } from '@/lib/format-date';

type Account = components['schemas']['Account'];

const BALANCE_PATTERN = /^-?\d+([.,]\d{1,2})?$/;
const AMOUNT_PATTERN = /^\d+([.,]\d{1,2})?$/;
const COMMENT_MIN_LENGTH = 3;
export const COMMENT_MAX_LENGTH = 256;

export function readAmountText(amountText: string): string | undefined {
  const trimmedText = amountText.trim();
  const amount = BALANCE_PATTERN.test(trimmedText) ? trimmedText.replace(',', '.') : undefined;
  return amount;
}

export function isBaseCurrencyAmountNeeded({
  account,
  baseCurrency,
}: Readonly<{ account: Readonly<Account> | undefined; baseCurrency: string }>): boolean {
  const isNeeded =
    account !== undefined &&
    account.currency !== baseCurrency &&
    Number(account.base_currency_rate) <= 0;
  return isNeeded;
}

export function createAdjustmentFormSchema({
  account,
  baseCurrency,
  today,
}: Readonly<{ account: Readonly<Account> | undefined; baseCurrency: string; today: string }>) {
  const adjustmentFormSchema = z.object({
    account_id: z.string().min(1, 'Choose the account to adjust'),
    new_balance: z
      .string()
      .transform((text) => readAmountText(text))
      .pipe(z.string({ error: 'Enter the new balance, like 1180.50' }))
      .refine((amount) => account === undefined || Number(amount) !== Number(account.balance), {
        error: 'The account already has this balance',
      }),
    base_currency_amount: z
      .string()
      .trim()
      .transform((text) => (text === '' ? null : text.replace(',', '.')))
      .refine((amount) => amount === null || (AMOUNT_PATTERN.test(amount) && Number(amount) > 0), {
        error: `Enter the amount in ${baseCurrency}, like 42.80`,
      }),
    transaction_date: z
      .string()
      .transform((text) => readIsoDate(text))
      .pipe(z.string({ error: `Enter a date as ${DATE_TEXT_PLACEHOLDER}` }))
      .refine((isoDate) => isoDate <= today, { error: 'Choose a date up to today' }),
    comment: z
      .string()
      .trim()
      .refine((comment) => comment === '' || comment.length >= COMMENT_MIN_LENGTH, {
        error: `Write at least ${String(COMMENT_MIN_LENGTH)} characters`,
      })
      .transform((comment) => (comment === '' ? null : comment)),
  });
  return adjustmentFormSchema;
}
