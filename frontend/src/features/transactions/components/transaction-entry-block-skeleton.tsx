import { Skeleton } from '@/components/skeleton/skeleton';
import { SkeletonLine } from '@/components/skeleton/skeleton-line';

import type { TransactionEntryFrame } from './transaction-entry-block';
import styles from './transaction-entry-block.module.css';

type TransactionEntryBlockSkeletonProps = Readonly<{ entryFrame: TransactionEntryFrame }>;

export function TransactionEntryBlockSkeleton({ entryFrame }: TransactionEntryBlockSkeletonProps) {
  return (
    <div className={styles['transactionEntryBlock']} aria-hidden="true">
      <span className={styles['role']}>{entryFrame.role}</span>
      <div className={styles['entry']}>
        <Skeleton
          className={
            entryFrame.isMoneyAccount ? styles['moneyAccountMarkSkeleton'] : styles['markSkeleton']
          }
        />
        <span className={styles['identity']}>
          <SkeletonLine textClassName={styles['name']} className={styles['nameSkeleton']} />
          <SkeletonLine textClassName={styles['note']} className={styles['noteSkeleton']} />
          {entryFrame.hasBalance && (
            <SkeletonLine textClassName={styles['note']} className={styles['balanceSkeleton']} />
          )}
        </span>
        <span className={styles['amounts']}>
          <SkeletonLine textClassName={styles['amount']} className={styles['amountSkeleton']} />
          {entryFrame.hasBaseAmount && (
            <SkeletonLine textClassName={styles['note']} className={styles['baseAmountSkeleton']} />
          )}
        </span>
      </div>
    </div>
  );
}
