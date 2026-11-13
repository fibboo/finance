import type { components } from '@/lib/api-schema';
import { toDateText } from '@/lib/format-date';
import { formatMoney } from '@/lib/format-money';

import {
  DEFAULT_ORDER,
  type ItemIdParam,
  type TransactionFilters,
} from '../api/transaction-filters';
import { ItemFilter } from './item-filter';
import { AmountFilter } from './amount-filter';
import styles from './filter-chips.module.css';
import { FilterPanel } from './filter-panel';
import { PeriodFilter } from './period-filter';
import { SortFilter } from './sort-filter';
import { TypeFilter } from './type-filter';

type DictionaryItem = components['schemas']['DictionaryItem'];
type Account = components['schemas']['Account'];
type Location = components['schemas']['Location'];

function readPeriodLabel(filters: TransactionFilters): string | undefined {
  const periodLabel =
    filters.date_from === undefined ? undefined : `From ${toDateText(filters.date_from)}`;
  return periodLabel;
}

function readTypeLabel({
  filters,
  transactionTypes,
}: Readonly<{
  filters: TransactionFilters;
  transactionTypes: readonly DictionaryItem[];
}>): string | undefined {
  const firstType = transactionTypes.find((transactionType) =>
    filters.transaction_types.some((type) => type === transactionType.key),
  );
  const otherCount = filters.transaction_types.length - 1;
  const typeLabel =
    firstType === undefined
      ? undefined
      : `${firstType.label}${otherCount > 0 ? ` +${String(otherCount)}` : ''}`;
  return typeLabel;
}

function readAmountLabel({
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
  const amountLabel =
    from !== undefined && to !== undefined
      ? `${from}–${to}`
      : from !== undefined
        ? `Over ${from}`
        : to !== undefined
          ? `Under ${to}`
          : undefined;
  return amountLabel;
}

type ItemFilterConfig = Readonly<{
  name: ItemIdParam;
  title: string;
  chipTitle: string;
  emptyNote: string;
  excluded?: Readonly<{ name: ItemIdParam; note: string }>;
}>;

const ITEM_FILTERS: readonly ItemFilterConfig[] = [
  {
    name: 'account_ids',
    title: 'Accounts',
    chipTitle: 'Accounts',
    emptyNote: 'No accounts yet.',
  },
  {
    name: 'category_ids',
    title: 'Categories',
    chipTitle: 'Categories',
    emptyNote: 'No categories yet.',
    excluded: {
      name: 'income_source_ids',
      note: 'Choosing categories clears the income sources filter.',
    },
  },
  {
    name: 'income_source_ids',
    title: 'Income sources',
    chipTitle: 'Income',
    emptyNote: 'No income sources yet.',
    excluded: {
      name: 'category_ids',
      note: 'Choosing income sources clears the categories filter.',
    },
  },
  {
    name: 'location_ids',
    title: 'Locations',
    chipTitle: 'Locations',
    emptyNote: 'No locations yet.',
  },
];

type FilterChipsProps = Readonly<{
  filters: TransactionFilters;
  today: string;
  anchorDate: string | undefined;
  baseCurrency: string;
  transactionTypes: readonly DictionaryItem[];
  transactionOrders: readonly DictionaryItem[];
  items: Readonly<Record<ItemIdParam, readonly (Account | Location)[]>>;
  onApply: (change: Partial<TransactionFilters>, jumpDate?: string) => void;
  onJump: (monthEnd: string) => void;
}>;

export function FilterChips({
  filters,
  today,
  anchorDate,
  baseCurrency,
  transactionTypes,
  transactionOrders,
  items,
  onApply,
  onJump,
}: FilterChipsProps) {
  const periodLabel = readPeriodLabel(filters);
  const typeLabel = readTypeLabel({ filters, transactionTypes });
  const amountLabel = readAmountLabel({ filters, baseCurrency });
  const order = filters.order ?? DEFAULT_ORDER;
  const orderLabel =
    transactionOrders.find((transactionOrder) => transactionOrder.key === order)?.label ?? 'Sort';
  return (
    <div role="group" aria-label="Filters" className={styles['filterChips']}>
      <FilterPanel
        title="Period"
        chipLabel={periodLabel ?? 'Period'}
        isActive={periodLabel !== undefined}
      >
        {(close) => (
          <PeriodFilter
            filters={filters}
            today={today}
            anchorDate={anchorDate}
            isJumpAvailable={filters.order === undefined}
            onJump={(monthEnd) => {
              onJump(monthEnd);
              close();
            }}
            onApply={(period, jumpDate) => {
              onApply(period, jumpDate);
              close();
            }}
          />
        )}
      </FilterPanel>
      <FilterPanel title="Type" chipLabel={typeLabel ?? 'Type'} isActive={typeLabel !== undefined}>
        {(close) => (
          <TypeFilter
            filters={filters}
            transactionTypes={transactionTypes}
            onApply={(types) => {
              onApply(types);
              close();
            }}
          />
        )}
      </FilterPanel>
      {ITEM_FILTERS.map((itemFilter) => {
        const count = filters[itemFilter.name].length;
        const { excluded } = itemFilter;
        const isExcludedChosen = excluded !== undefined && filters[excluded.name].length > 0;
        return (
          <FilterPanel
            key={itemFilter.name}
            title={itemFilter.title}
            chipLabel={
              count > 0 ? `${itemFilter.chipTitle} · ${String(count)}` : itemFilter.chipTitle
            }
            isActive={count > 0}
          >
            {(close) => (
              <ItemFilter
                title={itemFilter.title}
                emptyNote={itemFilter.emptyNote}
                items={items[itemFilter.name]}
                itemIds={filters[itemFilter.name]}
                note={isExcludedChosen ? excluded.note : undefined}
                onApply={(itemIds) => {
                  onApply({
                    [itemFilter.name]: itemIds,
                    ...(isExcludedChosen && itemIds.length > 0 && { [excluded.name]: [] }),
                  });
                  close();
                }}
              />
            )}
          </FilterPanel>
        );
      })}
      <FilterPanel
        title="Amount"
        chipLabel={amountLabel ?? 'Amount'}
        isActive={amountLabel !== undefined}
      >
        {(close) => (
          <AmountFilter
            filters={filters}
            baseCurrency={baseCurrency}
            onApply={(amounts) => {
              onApply(amounts);
              close();
            }}
          />
        )}
      </FilterPanel>
      <FilterPanel title="Sort" chipLabel={orderLabel} isActive={filters.order !== undefined}>
        {(close) => (
          <SortFilter
            order={order}
            transactionOrders={transactionOrders}
            baseCurrency={baseCurrency}
            onApply={(change) => {
              onApply({ order: change.order === DEFAULT_ORDER ? undefined : change.order });
              close();
            }}
          />
        )}
      </FilterPanel>
    </div>
  );
}
