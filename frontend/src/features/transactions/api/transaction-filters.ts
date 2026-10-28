import { z } from 'zod';

import { type components, transactionTypeValues } from '@/lib/api-schema';

import type { TransactionListQuery } from './transaction-queries';

type DictionaryItem = components['schemas']['DictionaryItem'];

export const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;

export const DATE_ORDER_PREFIX = 'transaction_date:';
export const DEFAULT_ORDER = `${DATE_ORDER_PREFIX}desc`;
export const OLDEST_FIRST_ORDER = `${DATE_ORDER_PREFIX}asc`;
const SINGLE_PARAMS = [
  'date_from',
  'base_currency_amount_from',
  'base_currency_amount_to',
  'order',
] as const;
const LIST_PARAMS = [
  'transaction_types',
  'account_ids',
  'category_ids',
  'income_source_ids',
] as const;
export const ACCOUNT_ID_PARAMS = ['account_ids', 'category_ids', 'income_source_ids'] as const;

const accountIdsSchema = z
  .array(z.string())
  .transform((ids) => [...new Set(ids.filter((id) => z.uuid().safeParse(id).success))]);

const transactionFiltersSchema = z.object({
  date_from: z.iso.date().optional().catch(undefined),
  transaction_types: z
    .array(z.string())
    .transform((types) => transactionTypeValues.filter((type) => types.includes(type))),
  base_currency_amount_from: z
    .string()
    .regex(AMOUNT_PATTERN)
    .refine((amount) => Number(amount) > 0)
    .optional()
    .catch(undefined),
  base_currency_amount_to: z
    .string()
    .regex(AMOUNT_PATTERN)
    .refine((amount) => Number(amount) > 0)
    .optional()
    .catch(undefined),
  order: z.string().optional(),
  account_ids: accountIdsSchema,
  category_ids: accountIdsSchema,
  income_source_ids: accountIdsSchema,
});

export type TransactionFilters = Readonly<z.output<typeof transactionFiltersSchema>>;

export type TransactionFilterQuery = Omit<TransactionListQuery, 'page' | 'size'>;

export function readTransactionFilters({
  searchParams,
  orders,
  today,
}: Readonly<{
  searchParams: URLSearchParams;
  orders: readonly DictionaryItem[];
  today: string;
}>): TransactionFilters {
  const parsedFilters = transactionFiltersSchema.parse({
    ...Object.fromEntries(SINGLE_PARAMS.map((name) => [name, searchParams.get(name) ?? undefined])),
    ...Object.fromEntries(LIST_PARAMS.map((name) => [name, searchParams.getAll(name)])),
  });
  const dateFrom = parsedFilters.date_from;
  const { base_currency_amount_from: amountFrom, base_currency_amount_to: amountTo } =
    parsedFilters;
  const isAmountRangeValid =
    amountFrom === undefined || amountTo === undefined || Number(amountFrom) <= Number(amountTo);
  const filters = {
    ...parsedFilters,
    date_from: dateFrom !== undefined && dateFrom <= today ? dateFrom : undefined,
    base_currency_amount_from: isAmountRangeValid ? amountFrom : undefined,
    base_currency_amount_to: isAmountRangeValid ? amountTo : undefined,
    order:
      parsedFilters.order !== DEFAULT_ORDER &&
      orders.some((order) => order.key === parsedFilters.order)
        ? parsedFilters.order
        : undefined,
  };
  return filters;
}

export function writeTransactionFilters(filters: TransactionFilters): URLSearchParams {
  const searchParams = new URLSearchParams();
  for (const name of SINGLE_PARAMS) {
    const value = filters[name];
    if (value !== undefined) {
      searchParams.set(name, value);
    }
  }

  for (const name of LIST_PARAMS) {
    for (const value of filters[name]) {
      searchParams.append(name, value);
    }
  }

  return searchParams;
}

export function readTransactionFilterQuery(filters: TransactionFilters): TransactionFilterQuery {
  const accountIds = ACCOUNT_ID_PARAMS.flatMap((name) => filters[name]);
  const filterQuery = {
    ...(filters.date_from !== undefined && { date_from: filters.date_from }),
    ...(filters.transaction_types.length > 0 && {
      transaction_types: [...filters.transaction_types],
    }),
    ...(filters.base_currency_amount_from !== undefined && {
      base_currency_amount_from: filters.base_currency_amount_from,
    }),
    ...(filters.base_currency_amount_to !== undefined && {
      base_currency_amount_to: filters.base_currency_amount_to,
    }),
    ...(filters.order !== undefined && { orders: [filters.order] }),
    ...(accountIds.length > 0 && { account_ids: accountIds }),
  };
  return filterQuery;
}

export function isSortedByDate(filters: TransactionFilters): boolean {
  const isDateOrder = filters.order === undefined || filters.order.startsWith(DATE_ORDER_PREFIX);
  return isDateOrder;
}

export function hasNarrowingFilters(filters: TransactionFilters): boolean {
  const isNarrowed =
    filters.date_from !== undefined ||
    filters.transaction_types.length > 0 ||
    filters.base_currency_amount_from !== undefined ||
    filters.base_currency_amount_to !== undefined ||
    ACCOUNT_ID_PARAMS.some((name) => filters[name].length > 0);
  return isNarrowed;
}
