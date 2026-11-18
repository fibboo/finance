import { type Ref, useImperativeHandle, useRef, useState } from 'react';

import type { components } from '@/lib/api-schema';

import {
  DEFAULT_ORDER,
  type ItemIdParam,
  type TransactionFilters,
} from '../api/transaction-filters';
import { AmountFilter } from './amount-filter';
import { itemFilters, readItemFilterLabel, type FilterItems } from './filter-labels';
import styles from './filters-panel.module.css';
import { ItemFilter } from './item-filter';
import { PeriodFilter } from './period-filter';
import { SortFilter } from './sort-filter';
import { TypeFilter } from './type-filter';
import type { PendingFilter } from './pending-filter';

export type FiltersPanelHandle = Readonly<{ applyPendingChanges: (jumpDate?: string) => boolean }>;

type FiltersPanelProps = Readonly<{
  ref?: Ref<FiltersPanelHandle>;
  filters: TransactionFilters;
  today: string;
  anchorDate: string | undefined;
  baseCurrency: string;
  transactionTypes: readonly components['schemas']['DictionaryItem'][];
  transactionOrders: readonly components['schemas']['DictionaryItem'][];
  items: FilterItems;
  total: number | undefined;
  isTotalPending: boolean;
  onApply: (change: Partial<TransactionFilters>, jumpDate?: string) => void;
  onJump: (monthEnd: string) => void;
  onReset: () => void;
  onClose: () => void;
}>;

function focusTitle(title: HTMLHeadingElement | null) {
  title?.focus();
}

export function FiltersPanel({
  ref,
  filters,
  today,
  anchorDate,
  baseCurrency,
  transactionTypes,
  transactionOrders,
  items,
  total,
  isTotalPending,
  onApply,
  onJump,
  onReset,
  onClose,
}: FiltersPanelProps) {
  const periodRef = useRef<PendingFilter>(null);
  const amountRef = useRef<PendingFilter>(null);
  const [selectedList, setSelectedList] = useState<ItemIdParam | undefined>();
  const selectedFilter = itemFilters.find((filter) => filter.name === selectedList);
  const excluded =
    selectedFilter !== undefined && 'excluded' in selectedFilter
      ? selectedFilter.excluded
      : undefined;

  function applyPendingChanges(jumpDate?: string) {
    const period = periodRef.current?.readPendingChange();
    const amounts = amountRef.current?.readPendingChange();
    if (period === undefined && amounts === undefined) {
      return false;
    }
    onApply({ ...period?.filters, ...amounts?.filters }, jumpDate ?? period?.jumpDate);
    return true;
  }
  useImperativeHandle(ref, () => ({ applyPendingChanges }));
  return (
    <>
      <div className={styles['header']} data-sheet-drag-area>
        {selectedFilter !== undefined && (
          <button
            type="button"
            className={styles['back']}
            aria-label="Back to filters"
            onClick={() => {
              setSelectedList(undefined);
            }}
          >
            ‹
          </button>
        )}
        <h2
          key={selectedList ?? 'filters'}
          ref={focusTitle}
          tabIndex={-1}
          className={styles['title']}
        >
          {selectedFilter?.title ?? 'Filters'}
        </h2>
        <button
          type="button"
          className={styles['reset']}
          onClick={() => {
            if (selectedFilter === undefined) {
              onReset();
            } else {
              onApply({ [selectedFilter.name]: [] });
            }
          }}
        >
          {selectedFilter === undefined ? 'Reset all' : 'Clear'}
        </button>
        <button
          type="button"
          className={styles['close']}
          aria-label="Close filters"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <div className={styles['content']}>
        {selectedFilter === undefined ? (
          <>
            <section className={styles['section']} aria-label="Period">
              <h3 className={styles['sectionTitle']}>Period</h3>
              <PeriodFilter
                ref={periodRef}
                filters={filters}
                today={today}
                anchorDate={anchorDate}
                isJumpAvailable={filters.order === undefined}
                onJump={(monthEnd) => {
                  if (!applyPendingChanges(monthEnd)) {
                    onJump(monthEnd);
                  }
                  onClose();
                }}
                onApply={onApply}
              />
            </section>
            <section className={styles['section']} aria-label="Amount">
              <h3 className={styles['sectionTitle']}>Amount, {baseCurrency}</h3>
              <AmountFilter
                ref={amountRef}
                filters={filters}
                baseCurrency={baseCurrency}
                onApply={onApply}
              />
            </section>
            <section className={styles['section']} aria-label="Type">
              <h3 className={styles['sectionTitle']}>Type</h3>
              <TypeFilter filters={filters} transactionTypes={transactionTypes} onApply={onApply} />
            </section>
            <div className={styles['lists']}>
              {itemFilters.map(({ name, title }) => (
                <button
                  key={name}
                  type="button"
                  className={styles['listRow']}
                  onClick={() => {
                    applyPendingChanges();
                    setSelectedList(name);
                  }}
                >
                  <span>{title}</span>
                  <span className={styles['choice']}>
                    {readItemFilterLabel({ itemIds: filters[name], items: items[name] }) ?? 'Any'} ›
                  </span>
                </button>
              ))}
            </div>
            <section className={styles['section']} aria-label="Sort">
              <h3 className={styles['sectionTitle']}>Sort</h3>
              <SortFilter
                order={filters.order ?? DEFAULT_ORDER}
                transactionOrders={transactionOrders}
                baseCurrency={baseCurrency}
                onApply={({ order }) => {
                  onApply({ order: order === DEFAULT_ORDER ? undefined : order });
                }}
              />
            </section>
          </>
        ) : (
          <ItemFilter
            key={selectedFilter.name}
            title={selectedFilter.title}
            emptyNote={selectedFilter.emptyNote}
            items={items[selectedFilter.name]}
            itemIds={filters[selectedFilter.name]}
            note={
              excluded !== undefined && filters[excluded.name].length > 0
                ? excluded.note
                : undefined
            }
            onApply={(itemIds) => {
              onApply({
                [selectedFilter.name]: itemIds,
                ...(excluded !== undefined && itemIds.length > 0 && { [excluded.name]: [] }),
              });
            }}
          />
        )}
      </div>
      <button type="button" className={styles['show']} aria-busy={isTotalPending} onClick={onClose}>
        {total === undefined
          ? 'Show transactions'
          : `Show ${String(total)} ${total === 1 ? 'transaction' : 'transactions'}`}
      </button>
    </>
  );
}
