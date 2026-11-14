import { SkeletonLine } from '@/components/skeleton/skeleton-line';

import { AccountActionsSkeleton } from './account-actions-skeleton';
import balanceStyles from './account-balance.module.css';
import styles from './account-details.module.css';

export function AccountSummarySkeleton() {
  return (
    <div className={styles['summary']}>
      <div className={balanceStyles['inlineAmounts']} aria-hidden="true">
        <SkeletonLine
          textClassName={balanceStyles['balance']}
          className={styles['balanceSkeleton']}
        />
      </div>
      <AccountActionsSkeleton isMoneyAccount />
    </div>
  );
}
