import type { ReactNode } from 'react';

import { ActionBar } from '@/components/action-bar/action-bar';
import { ActionButton } from '@/components/action-button/action-button';
import {
  DELETE_ICON_PATH,
  EDIT_ICON_PATH,
  TRANSACTIONS_ICON_PATH,
} from '@/components/action-button/action-icons';
import { SkeletonLine } from '@/components/skeleton/skeleton-line';

import styles from './location-details.module.css';

type LocationDetailsSkeletonProps = Readonly<{
  markIconPath: string;
  closeButton: ReactNode;
}>;

export function LocationDetailsSkeleton({
  markIconPath,
  closeButton,
}: LocationDetailsSkeletonProps) {
  return (
    <div className={styles['locationDetails']}>
      <div className={styles['header']} data-sheet-drag-area>
        <span className={styles['mark']} aria-hidden="true">
          <svg className={styles['markIcon']} viewBox="0 0 24 24">
            <path d={markIconPath} />
          </svg>
        </span>
        <div className={styles['heading']} aria-hidden="true">
          <span className={styles['meta']}>Location</span>
          <SkeletonLine textClassName={styles['title']} className={styles['titleSkeleton']} />
        </div>
        {closeButton}
      </div>
      <ActionBar>
        <ActionButton
          label="Transactions"
          iconPath={TRANSACTIONS_ICON_PATH}
          isDanger={false}
          action={{ kind: 'disabled' }}
        />
        <ActionButton
          label="Edit"
          iconPath={EDIT_ICON_PATH}
          isDanger={false}
          action={{ kind: 'disabled' }}
        />
        <ActionButton
          label="Delete"
          iconPath={DELETE_ICON_PATH}
          isDanger
          action={{ kind: 'disabled' }}
        />
      </ActionBar>
    </div>
  );
}
