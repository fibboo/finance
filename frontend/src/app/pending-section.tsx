import { Page } from '@/components/page/page';
import { Skeleton } from '@/components/skeleton/skeleton';
import { listSkeletonKeys } from '@/components/skeleton/skeleton-keys';

import styles from './pending-section.module.css';

const ROW_SKELETON_COUNT = 4;

type PendingSectionProps = Readonly<{ name: string }>;

export function PendingSection({ name }: PendingSectionProps) {
  return (
    <Page title={name}>
      <section className={styles['pendingSection']} aria-label={name} aria-busy="true">
        <ul className={styles['rows']}>
          {listSkeletonKeys(ROW_SKELETON_COUNT).map((key) => (
            <li key={key} className={styles['row']}>
              <Skeleton className={styles['markSkeleton']} />
              <Skeleton className={styles['nameSkeleton']} />
            </li>
          ))}
        </ul>
      </section>
    </Page>
  );
}
