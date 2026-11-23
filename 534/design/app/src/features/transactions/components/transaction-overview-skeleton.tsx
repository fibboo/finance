import type { ReactNode } from 'react';

import { ActionBar } from '@/components/action-bar/action-bar';
import { ActionButton } from '@/components/action-button/action-button';
import { DELETE_ICON_PATH, EDIT_ICON_PATH } from '@/components/action-button/action-icons';
import { Skeleton } from '@/components/skeleton/skeleton';
import { SkeletonLine } from '@/components/skeleton/skeleton-line';

import { TransactionEntryBlockSkeleton } from './transaction-entry-block-skeleton';
import type { TransactionFrame } from './transaction-overview';
import styles from './transaction-overview.module.css';

type TransactionOverviewSkeletonProps = Readonly<{
  transactionFrame: TransactionFrame;
  closeButton: ReactNode;
}>;

export function TransactionOverviewSkeleton({
  transactionFrame,
  closeButton,
}: TransactionOverviewSkeletonProps) {
  return (
    <div className={styles['transactionOverview']}>
      <div className={styles['header']} data-sheet-drag-area>
        <div className={styles['heading']} aria-hidden="true">
          <SkeletonLine textClassName={styles['meta']} className={styles['metaSkeleton']} />
          <SkeletonLine textClassName={styles['title']} className={styles['titleSkeleton']} />
        </div>
        {closeButton}
      </div>
      <div className={styles['amounts']} aria-hidden="true">
        <SkeletonLine textClassName={styles['amount']} className={styles['amountSkeleton']} />
        {transactionFrame.hasBaseAmount && (
          <SkeletonLine
            textClassName={styles['baseAmount']}
            className={styles['baseAmountSkeleton']}
          />
        )}
      </div>
      {transactionFrame.entryFrames.map((entryFrame) => (
        <TransactionEntryBlockSkeleton key={entryFrame.role} entryFrame={entryFrame} />
      ))}
      <dl className={styles['facts']} aria-hidden="true">
        {transactionFrame.hasExchangeDifference && (
          <>
            <dt className={styles['term']}>Exchange difference</dt>
            <dd className={styles['skeletonValue']}>
              <Skeleton className={styles['factSkeleton']} />
            </dd>
          </>
        )}
        <dt className={styles['term']}>Location</dt>
        <dd className={styles['skeletonValue']}>
          <Skeleton className={styles['factSkeleton']} />
        </dd>
        <dt className={styles['term']}>Comment</dt>
        <dd className={styles['skeletonValue']}>
          <Skeleton className={styles['commentSkeleton']} />
        </dd>
      </dl>
      <ActionBar>
        <ActionButton
          label="Edit transaction"
          iconPath={EDIT_ICON_PATH}
          isDanger={false}
          action={{ kind: 'disabled' }}
        />
        <ActionButton
          label="Delete transaction"
          iconPath={DELETE_ICON_PATH}
          isDanger
          action={{ kind: 'disabled' }}
        />
      </ActionBar>
    </div>
  );
}
