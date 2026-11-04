import { z } from 'zod';

import type { components } from '@/lib/api-schema';
import { DATE_TEXT_PLACEHOLDER, readIsoDate } from '@/lib/format-date';

type Account = components['schemas']['Account'];
type MovementRequest = components['schemas']['MovementRequest'];

const BALANCE_PATTERN = /^-?\d+([.,]\d{1,2})?$/;
const AMOUNT_PATTERN = /^\d+([.,]\d{1,2})?$/;
const COMMENT_MIN_LENGTH = 3;
export const COMMENT_MAX_LENGTH = 256;
const EXPENSE_SOURCE_ERROR = 'Choose the account you paid from';
const INCOME_SOURCE_ERROR = 'Choose the income source';
const INCOME_ACCOUNT_ERROR = 'Choose the account you received to';
const TRANSFER_SOURCE_ERROR = 'Choose the account you sent from';
const TRANSFER_DESTINATION_ERROR = 'Choose the account you sent to';

const skippedTextSchema = z.string().transform(() => null);

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

function createMovementFieldsSchema(today: string) {
  const movementFieldsSchema = z.object({
    from_account_id: z.string(),
    to_account_id: z.string(),
    location_id: skippedTextSchema,
    source_amount: skippedTextSchema,
    source_currency: skippedTextSchema,
    is_paid_in_another_currency: z.boolean(),
    destination_amount: skippedTextSchema,
    destination_currency: skippedTextSchema,
    base_currency_amount: skippedTextSchema,
    income_period: skippedTextSchema,
    transaction_date: createTransactionDateSchema(today),
    comment: commentSchema,
  });
  return movementFieldsSchema;
}

export type MovementFormValues = z.input<ReturnType<typeof createMovementFieldsSchema>>;

export type MovementFormSchema = z.ZodType<MovementRequest, MovementFormValues>;

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

export function readPreviousMonth(isoDate: string): string {
  const monthStart = new Date(
    Date.UTC(Number(isoDate.slice(0, 4)), Number(isoDate.slice(5, 7)) - 2, 1),
  );
  const previousMonth = monthStart.toISOString().slice(0, 10);
  return previousMonth;
}

function createChosenTextSchema({ isAsked, error }: Readonly<{ isAsked: boolean; error: string }>) {
  const chosenTextSchema = isAsked ? z.string().min(1, error) : skippedTextSchema;
  return chosenTextSchema;
}

function createAskedAmountSchema({
  isAsked,
  error,
}: Readonly<{ isAsked: boolean; error: string }>) {
  const askedAmountSchema = isAsked ? createAmountSchema(error) : skippedTextSchema;
  return askedAmountSchema;
}

function addAccountIssue({
  context,
  field,
  message,
}: Readonly<{
  context: z.RefinementCtx;
  field: 'from_account_id' | 'to_account_id';
  message: string;
}>): void {
  context.addIssue({ code: 'custom', path: [field], message });
}

export function createIncomeFormSchema({
  destinationCurrency,
  isPaidInAnotherCurrency,
  isBaseCurrencyAmountAsked,
  baseCurrency,
  today,
}: Readonly<{
  destinationCurrency: string | undefined;
  isPaidInAnotherCurrency: boolean;
  isBaseCurrencyAmountAsked: boolean;
  baseCurrency: string;
  today: string;
}>): MovementFormSchema {
  const incomeFormSchema = createMovementFieldsSchema(today)
    .extend({
      from_account_id: z.string().min(1, INCOME_SOURCE_ERROR),
      to_account_id: z.string().min(1, INCOME_ACCOUNT_ERROR),
      source_amount: createAskedAmountSchema({
        isAsked: isPaidInAnotherCurrency,
        error: 'Enter the paid amount, like 120.00',
      }),
      source_currency: createChosenTextSchema({
        isAsked: isPaidInAnotherCurrency,
        error: 'Choose the paid currency',
      }),
      destination_amount: createAmountSchema('Enter the amount received, like 3200.00'),
      base_currency_amount: createAskedAmountSchema({
        isAsked: isBaseCurrencyAmountAsked,
        error: `Enter the amount in ${baseCurrency}, like 42.80`,
      }),
      income_period: z.string(),
    })
    .transform((values, context) => {
      if (destinationCurrency === undefined) {
        addAccountIssue({ context, field: 'to_account_id', message: INCOME_ACCOUNT_ERROR });
        return z.NEVER;
      }

      const income = {
        from_account_id: values.from_account_id,
        to_account_id: values.to_account_id,
        source_amount: values.source_amount ?? values.destination_amount,
        source_currency: values.source_currency ?? destinationCurrency,
        destination_amount: values.destination_amount,
        destination_currency: destinationCurrency,
        base_currency_amount: values.base_currency_amount,
        income_period:
          values.income_period === ''
            ? readPreviousMonth(values.transaction_date)
            : values.income_period,
        transaction_date: values.transaction_date,
        comment: values.comment,
      } satisfies MovementRequest;
      return income;
    });
  return incomeFormSchema;
}

export function createTransferFormSchema({
  sourceCurrency,
  destinationCurrency,
  isDestinationAmountAsked,
  today,
}: Readonly<{
  sourceCurrency: string | undefined;
  destinationCurrency: string | undefined;
  isDestinationAmountAsked: boolean;
  today: string;
}>): MovementFormSchema {
  const transferFormSchema = createMovementFieldsSchema(today)
    .extend({
      from_account_id: z.string().min(1, TRANSFER_SOURCE_ERROR),
      to_account_id: z.string().min(1, TRANSFER_DESTINATION_ERROR),
      source_amount: createAmountSchema('Enter the amount sent, like 500.00'),
      destination_amount: createAskedAmountSchema({
        isAsked: isDestinationAmountAsked,
        error: 'Enter the amount received, like 1455.00',
      }),
    })
    .transform((values, context) => {
      if (sourceCurrency === undefined) {
        addAccountIssue({ context, field: 'from_account_id', message: TRANSFER_SOURCE_ERROR });
      }

      if (destinationCurrency === undefined) {
        addAccountIssue({
          context,
          field: 'to_account_id',
          message: TRANSFER_DESTINATION_ERROR,
        });
      }

      if (sourceCurrency === undefined || destinationCurrency === undefined) {
        return z.NEVER;
      }

      const transfer = {
        from_account_id: values.from_account_id,
        to_account_id: values.to_account_id,
        source_amount: values.source_amount,
        source_currency: sourceCurrency,
        destination_amount: values.destination_amount,
        destination_currency: destinationCurrency,
        transaction_date: values.transaction_date,
        comment: values.comment,
      } satisfies MovementRequest;
      return transfer;
    });
  return transferFormSchema;
}

export function createExpenseFormSchema({
  sourceCurrency,
  isPaidInAnotherCurrency,
  today,
}: Readonly<{
  sourceCurrency: string | undefined;
  isPaidInAnotherCurrency: boolean;
  today: string;
}>): MovementFormSchema {
  const expenseFormSchema = createMovementFieldsSchema(today)
    .extend({
      from_account_id: z.string().min(1, EXPENSE_SOURCE_ERROR),
      to_account_id: z.string().min(1, 'Choose a category'),
      location_id: z.string().min(1, 'Choose a location'),
      source_amount: createAmountSchema('Enter the amount, like 42.80'),
      destination_amount: createAskedAmountSchema({
        isAsked: isPaidInAnotherCurrency,
        error: 'Enter the seller’s amount, like 120.00',
      }),
      destination_currency: createChosenTextSchema({
        isAsked: isPaidInAnotherCurrency,
        error: 'Choose the seller’s currency',
      }),
    })
    .transform((values, context) => {
      if (sourceCurrency === undefined) {
        addAccountIssue({ context, field: 'from_account_id', message: EXPENSE_SOURCE_ERROR });
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
