import { Skeleton } from '@/components/skeleton/skeleton';
import { listSkeletonKeys } from '@/components/skeleton/skeleton-keys';

import styles from './transaction-skeleton-rows.module.css';

type TransactionSkeletonRowsProps = Readonly<{ count: number }>;

export function TransactionSkeletonRows({ count }: TransactionSkeletonRowsProps) {
  return (
    <ul className={styles['transactionSkeletonRows']}>
      {listSkeletonKeys(count).map((key) => (
        <li key={key} className={styles['skeletonRow']}>
          <Skeleton className={styles['dotSkeleton']} />
          <span className={styles['textSkeleton']}>
            <Skeleton className={styles['titleSkeleton']} />
            <Skeleton className={styles['detailsSkeleton']} />
          </span>
          <Skeleton className={styles['amountSkeleton']} />
        </li>
      ))}
    </ul>
  );
}
