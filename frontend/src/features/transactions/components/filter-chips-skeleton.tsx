import { Skeleton } from '@/components/skeleton/skeleton';

import styles from './filter-chips.module.css';

const CHIP_KEYS = ['type', 'period', 'accounts', 'location', 'amount', 'sort'] as const;

export function FilterChipsSkeleton() {
  return (
    <div className={styles['filterChips']} aria-hidden="true">
      {CHIP_KEYS.map((chipKey) => (
        <Skeleton key={chipKey} className={styles['chipSkeleton']} />
      ))}
    </div>
  );
}
