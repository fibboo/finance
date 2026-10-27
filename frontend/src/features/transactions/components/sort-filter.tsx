import type { components } from '@/lib/api-schema';

import { DATE_ORDER_PREFIX, type TransactionFilters } from '../api/transaction-filters';
import styles from './sort-filter.module.css';

type DictionaryItem = components['schemas']['DictionaryItem'];

type SortFilterProps = Readonly<{
  order: string;
  transactionOrders: readonly DictionaryItem[];
  baseCurrency: string;
  onApply: (order: Pick<TransactionFilters, 'order'>) => void;
}>;

export function SortFilter({ order, transactionOrders, baseCurrency, onApply }: SortFilterProps) {
  return (
    <div role="group" aria-label="Order" className={styles['sortFilter']}>
      {transactionOrders.map((transactionOrder) => (
        <button
          key={transactionOrder.key}
          type="button"
          className={styles['order']}
          aria-pressed={transactionOrder.key === order}
          onClick={() => {
            onApply({ order: transactionOrder.key });
          }}
        >
          <span className={styles['mark']} aria-hidden="true" />
          <span className={styles['label']}>{transactionOrder.label}</span>
          <span className={styles['hint']}>
            {transactionOrder.key.startsWith(DATE_ORDER_PREFIX) ? 'By date' : `In ${baseCurrency}`}
          </span>
        </button>
      ))}
    </div>
  );
}
