import type { components } from '@/lib/api-schema';
import { toDateText } from '@/lib/format-date';
import { formatMoney } from '@/lib/format-money';

import { DEFAULT_ORDER, type TransactionFilters } from '../api/transaction-filters';
import { AmountFilter } from './amount-filter';
import styles from './filter-chips.module.css';
import { FilterPanel } from './filter-panel';
import { PeriodFilter } from './period-filter';
import { SortFilter } from './sort-filter';
import { TypeFilter } from './type-filter';

type DictionaryItem = components['schemas']['DictionaryItem'];

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

type FilterChipsProps = Readonly<{
  filters: TransactionFilters;
  today: string;
  anchorDate: string | undefined;
  baseCurrency: string;
  transactionTypes: readonly DictionaryItem[];
  transactionOrders: readonly DictionaryItem[];
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
