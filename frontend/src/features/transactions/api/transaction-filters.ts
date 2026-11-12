import { z } from 'zod';

import { PLAIN_AMOUNT_PATTERN } from '@/lib/amount-input';
import { type components, transactionTypeValues } from '@/lib/api-schema';
import { readSearchTerm } from '@/lib/search-term';

import type { TransactionListQuery } from './transaction-queries';

type DictionaryItem = components['schemas']['DictionaryItem'];

export const DATE_ORDER_PREFIX = 'transaction_date:';
export const DEFAULT_ORDER = `${DATE_ORDER_PREFIX}desc`;
export const OLDEST_FIRST_ORDER = `${DATE_ORDER_PREFIX}asc`;
const SEARCH_PARAM = 'search';
const SINGLE_PARAMS = [
  SEARCH_PARAM,
  'date_from',
  'base_currency_amount_from',
  'base_currency_amount_to',
  'order',
] as const;
const ACCOUNT_ID_PARAMS = ['account_ids', 'category_ids', 'income_source_ids'] as const;
const LIST_PARAMS = ['transaction_types', ...ACCOUNT_ID_PARAMS] as const;

export type AccountIdParam = (typeof ACCOUNT_ID_PARAMS)[number];

const transactionFiltersSchema = z.object({
  search: z.string().min(1).optional().catch(undefined),
  date_from: z.iso.date().optional().catch(undefined),
  transaction_types: z
    .array(z.string())
    .transform((types) => transactionTypeValues.filter((type) => types.includes(type))),
  base_currency_amount_from: z
    .string()
    .regex(PLAIN_AMOUNT_PATTERN)
    .refine((amount) => Number(amount) > 0)
    .optional()
    .catch(undefined),
  base_currency_amount_to: z
    .string()
    .regex(PLAIN_AMOUNT_PATTERN)
    .refine((amount) => Number(amount) > 0)
    .optional()
    .catch(undefined),
  order: z.string().optional(),
  account_ids: z.array(z.string()),
  category_ids: z.array(z.string()),
  income_source_ids: z.array(z.string()),
});

export type TransactionFilters = Readonly<z.output<typeof transactionFiltersSchema>>;

export type TransactionFilterQuery = Omit<TransactionListQuery, 'page' | 'size'>;

export function readTransactionFilters({
  searchParams,
  orders,
  accounts,
  today,
}: Readonly<{
  searchParams: URLSearchParams;
  orders: readonly DictionaryItem[];
  accounts: Readonly<Record<AccountIdParam, readonly Readonly<{ id: string }>[]>> | undefined;
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
  const [accountIds, categoryIds, incomeSourceIds] = ACCOUNT_ID_PARAMS.map((name) =>
    (accounts?.[name] ?? [])
      .filter((account) => parsedFilters[name].includes(account.id))
      .map((account) => account.id),
  );
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
    account_ids: accountIds ?? [],
    category_ids: categoryIds ?? [],
    income_source_ids:
      categoryIds !== undefined && categoryIds.length > 0 ? [] : (incomeSourceIds ?? []),
  };
  return filters;
}

export function hasAccountIdParams(searchParams: URLSearchParams): boolean {
  const hasAccountIds = ACCOUNT_ID_PARAMS.some((name) => searchParams.has(name));
  return hasAccountIds;
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

export function readTransactionSearch(searchParams: URLSearchParams): string {
  const search = searchParams.get(SEARCH_PARAM) ?? '';
  return search;
}

export function writeTransactionSearch({
  searchParams,
  search,
}: Readonly<{ searchParams: URLSearchParams; search: string }>): URLSearchParams {
  const nextSearchParams = new URLSearchParams(searchParams);
  if (search === '') {
    nextSearchParams.delete(SEARCH_PARAM);
  } else {
    nextSearchParams.set(SEARCH_PARAM, search);
  }

  return nextSearchParams;
}

export function readTransactionFilterQuery(filters: TransactionFilters): TransactionFilterQuery {
  const accountIds = ACCOUNT_ID_PARAMS.flatMap((name) => filters[name]);
  const searchTerm = filters.search === undefined ? undefined : readSearchTerm(filters.search);
  const filterQuery = {
    ...(searchTerm !== undefined && { search_term: searchTerm }),
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
    (filters.search !== undefined && readSearchTerm(filters.search) !== undefined) ||
    filters.date_from !== undefined ||
    filters.transaction_types.length > 0 ||
    filters.base_currency_amount_from !== undefined ||
    filters.base_currency_amount_to !== undefined ||
    ACCOUNT_ID_PARAMS.some((name) => filters[name].length > 0);
  return isNarrowed;
}
