import { Skeleton } from '@/components/skeleton/skeleton';

import styles from './transaction-form-skeleton.module.css';

export function TransactionFormSkeleton() {
  return (
    <div className={styles['skeleton']} aria-busy="true">
      <Skeleton className={styles['titleSkeleton']} />
      <Skeleton className={styles['amountSkeleton']} />
      <Skeleton className={styles['rowsSkeleton']} />
    </div>
  );
}
