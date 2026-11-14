import type { ReactNode } from 'react';

import { Skeleton } from '@/components/skeleton/skeleton';
import { SkeletonLine } from '@/components/skeleton/skeleton-line';

import { AccountActionsSkeleton } from './account-actions-skeleton';
import balanceStyles from './account-balance.module.css';
import styles from './account-overview.module.css';

type AccountOverviewSkeletonProps = Readonly<{
  isMoneyAccount: boolean;
  closeButton: ReactNode;
}>;

export function AccountOverviewSkeleton({
  isMoneyAccount,
  closeButton,
}: AccountOverviewSkeletonProps) {
  return (
    <div className={styles['accountOverview']}>
      <div className={styles['header']} data-sheet-drag-area>
        <Skeleton className={styles['markSkeleton']} />
        <div className={styles['heading']} aria-hidden="true">
          <SkeletonLine textClassName={styles['meta']} className={styles['metaSkeleton']} />
          <SkeletonLine textClassName={styles['title']} className={styles['titleSkeleton']} />
        </div>
        {closeButton}
      </div>
      {isMoneyAccount && (
        <div className={balanceStyles['amounts']} aria-hidden="true">
          <SkeletonLine
            textClassName={balanceStyles['balance']}
            className={styles['balanceSkeleton']}
          />
          <SkeletonLine
            textClassName={balanceStyles['baseBalance']}
            className={styles['baseBalanceSkeleton']}
          />
        </div>
      )}
      <AccountActionsSkeleton isMoneyAccount={isMoneyAccount} />
    </div>
  );
}
