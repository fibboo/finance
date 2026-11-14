import type { ReactNode } from 'react';

import styles from './transaction-overview.module.css';

type TransactionOverviewEmptyProps = Readonly<{ closeButton: ReactNode }>;

export function TransactionOverviewEmpty({ closeButton }: TransactionOverviewEmptyProps) {
  return (
    <div className={styles['transactionOverview']}>
      <div className={styles['header']} data-sheet-drag-area>
        <p className={styles['emptyText']}>No transactions yet</p>
        {closeButton}
      </div>
    </div>
  );
}
