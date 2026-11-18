import type { components } from '@/lib/api-schema';
import { toDateText } from '@/lib/format-date';
import { formatMoney } from '@/lib/format-money';

import type { ItemIdParam, TransactionFilters } from '../api/transaction-filters';

export type FilterItems = Readonly<
  Record<
    ItemIdParam,
    readonly (components['schemas']['Account'] | components['schemas']['Location'])[]
  >
>;

export const itemFilters = [
  { name: 'account_ids', title: 'Accounts', emptyNote: 'No accounts yet.' },
  {
    name: 'category_ids',
    title: 'Categories',
    emptyNote: 'No categories yet.',
    excluded: {
      name: 'income_source_ids',
      note: 'Choosing categories clears the income sources filter.',
    },
  },
  {
    name: 'income_source_ids',
    title: 'Income sources',
    emptyNote: 'No income sources yet.',
    excluded: {
      name: 'category_ids',
      note: 'Choosing income sources clears the categories filter.',
    },
  },
  { name: 'location_ids', title: 'Locations', emptyNote: 'No locations yet.' },
] as const;

export function readItemFilterLabel({
  itemIds,
  items,
}: Readonly<{
  itemIds: readonly string[];
  items: readonly Readonly<{ id: string; name: string }>[];
}>): string | undefined {
  const first = items.find((item) => itemIds.includes(item.id));
  const label =
    first === undefined
      ? itemIds.length === 0
        ? undefined
        : `${String(itemIds.length)} selected`
      : `${first.name}${itemIds.length > 1 ? ` +${String(itemIds.length - 1)}` : ''}`;
  return label;
}

function readAmountFilterLabel({
  filters,
  baseCurrency,
}: Readonly<{ filters: TransactionFilters; baseCurrency: string }>): string | undefined {
  const [from, to] = [filters.base_currency_amount_from, filters.base_currency_amount_to].map(
    (amount) =>
      amount === undefined
        ? undefined
        : formatMoney({
            amount: Number(amount),
            currency: baseCurrency,
            trailingZeroDisplay: 'stripIfInteger',
          }),
  );
  const label =
    from !== undefined && to !== undefined
      ? `${from}–${to}`
      : from !== undefined
        ? `Over ${from}`
        : to !== undefined
          ? `Under ${to}`
          : undefined;
  return label;
}

export function readFilterSummary({
  filters,
  baseCurrency,
  transactionTypes,
  transactionOrders,
  items,
}: Readonly<{
  filters: TransactionFilters;
  baseCurrency: string;
  transactionTypes: readonly components['schemas']['DictionaryItem'][];
  transactionOrders: readonly components['schemas']['DictionaryItem'][];
  items: FilterItems;
}>): string {
  const labels = [
    filters.date_from === undefined ? undefined : `From ${toDateText(filters.date_from)}`,
    transactionTypes
      .filter((type) => filters.transaction_types.some((key) => key === type.key))
      .map((type) => type.label)
      .join(', ') || undefined,
    ...itemFilters.map(({ name }) =>
      readItemFilterLabel({ itemIds: filters[name], items: items[name] }),
    ),
    readAmountFilterLabel({ filters, baseCurrency }),
    transactionOrders.find((order) => order.key === filters.order)?.label,
  ];
  const summary = labels.filter((label) => label !== undefined).join(' · ');
  return summary;
}
