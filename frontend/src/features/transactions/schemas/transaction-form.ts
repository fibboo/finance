import { z } from 'zod';

import type { components } from '@/lib/api-schema';
import { DATE_TEXT_PLACEHOLDER, readIsoDate } from '@/lib/format-date';

type Account = components['schemas']['Account'];
type MovementRequest = components['schemas']['MovementRequest'];

const BALANCE_PATTERN = /^-?\d+([.,]\d{1,2})?$/;
const AMOUNT_PATTERN = /^\d+([.,]\d{1,2})?$/;
const COMMENT_MIN_LENGTH = 3;
export const COMMENT_MAX_LENGTH = 256;

export function readAccountCurrency(account: Readonly<Account>): string {
  if (account.currency === null) {
    throw new Error(`The money account ${account.id} has no currency.`);
  }

  return account.currency;
}

export function readAmountText(amountText: string): string | undefined {
  const trimmedText = amountText.trim();
  const amount = BALANCE_PATTERN.test(trimmedText) ? trimmedText.replace(',', '.') : undefined;
  return amount;
}

function createTransactionDateSchema(today: string) {
  const transactionDateSchema = z
    .string()
    .transform((text) => readIsoDate(text))
    .pipe(z.string({ error: `Enter a date as ${DATE_TEXT_PLACEHOLDER}` }))
    .refine((isoDate) => isoDate <= today, { error: 'Choose a date up to today' });
  return transactionDateSchema;
}

const commentSchema = z
  .string()
  .trim()
  .refine((comment) => comment === '' || comment.length >= COMMENT_MIN_LENGTH, {
    error: `Write at least ${String(COMMENT_MIN_LENGTH)} characters`,
  })
  .transform((comment) => (comment === '' ? null : comment));

function createAmountSchema(error: string) {
  const amountSchema = z
    .string()
    .trim()
    .transform((text) => text.replace(',', '.'))
    .refine((amount) => AMOUNT_PATTERN.test(amount) && Number(amount) > 0, { error });
  return amountSchema;
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
    transaction_date: createTransactionDateSchema(today),
    comment: commentSchema,
  });
  return adjustmentFormSchema;
}

export function createExpenseFormSchema({
  sourceCurrency,
  isPaidInAnotherCurrency,
  today,
}: Readonly<{
  sourceCurrency: string | undefined;
  isPaidInAnotherCurrency: boolean;
  today: string;
}>) {
  const expenseFormSchema = z
    .object({
      from_account_id: z.string().min(1, 'Choose the account you paid from'),
      to_account_id: z.string().min(1, 'Choose a category'),
      location_id: z.string().min(1, 'Choose a location'),
      source_amount: createAmountSchema('Enter the amount, like 42.80'),
      is_paid_in_another_currency: z.boolean(),
      destination_amount: isPaidInAnotherCurrency
        ? createAmountSchema('Enter the seller’s amount, like 120.00')
        : z.string().transform(() => null),
      destination_currency: isPaidInAnotherCurrency
        ? z.string().min(1, 'Choose the seller’s currency')
        : z.string().transform(() => null),
      transaction_date: createTransactionDateSchema(today),
      comment: commentSchema,
    })
    .transform((values, context) => {
      if (sourceCurrency === undefined) {
        context.addIssue({
          code: 'custom',
          path: ['from_account_id'],
          message: 'Choose the account you paid from',
        });
        return z.NEVER;
      }

      const movement = {
        from_account_id: values.from_account_id,
        to_account_id: values.to_account_id,
        location_id: values.location_id,
        source_amount: values.source_amount,
        source_currency: sourceCurrency,
        destination_amount: values.destination_amount ?? values.source_amount,
        destination_currency: values.destination_currency ?? sourceCurrency,
        transaction_date: values.transaction_date,
        comment: values.comment,
      } satisfies MovementRequest;
      return movement;
    });
  return expenseFormSchema;
}
