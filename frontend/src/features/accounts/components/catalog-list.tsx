import { type ReactNode, useId } from 'react';
import { Link, useSearchParams } from 'react-router';

import { Skeleton } from '@/components/skeleton/skeleton';
import { listSkeletonKeys } from '@/components/skeleton/skeleton-keys';
import { useArrowKeySelection } from '@/hooks/use-arrow-key-selection';
import type { components } from '@/lib/api-schema';

import { readAccountLinkId, writeSelectedAccount } from '../api/selected-account';
import type { CatalogGroup } from './catalog-grouping';
import styles from './catalog-list.module.css';

type Account = components['schemas']['Account'];

const ENTRY_SKELETON_COUNT = 4;

type CatalogListProps = Readonly<{
  label: string;
  groups: readonly CatalogGroup[] | undefined;
  selection:
    Readonly<{ chosenEntryId: string | undefined; defaultEntryId: string | undefined }> | undefined;
  renderActions: (entry: Readonly<Account>) => ReactNode;
}>;

export function CatalogList({ label, groups, selection, renderActions }: CatalogListProps) {
  const headingId = useId();
  const [searchParams] = useSearchParams();
  const arrowKeySelection = useArrowKeySelection({
    list: 'catalog-entries',
    orientation: 'vertical',
  });
  return (
    <section className={styles['catalogList']} aria-label={label} aria-busy={groups === undefined}>
      {groups === undefined && (
        <ul className={styles['entries']}>
          {listSkeletonKeys(ENTRY_SKELETON_COUNT).map((key) => (
            <li key={key} className={styles['entry']}>
              <Skeleton className={styles['markSkeleton']} />
              <Skeleton className={styles['nameSkeleton']} />
            </li>
          ))}
        </ul>
      )}
      {groups?.map((group) => (
        <section
          key={group.key}
          className={styles['group']}
          aria-labelledby={`${headingId}-${group.key}`}
        >
          <div className={styles['groupHeader']}>
            <h2 id={`${headingId}-${group.key}`} className={styles['groupHeading']}>
              {group.heading}
            </h2>
            <span className={styles['groupCount']}>{group.entries.length}</span>
          </div>
          <ul className={styles['entries']}>
            {group.entries.map((entry) => {
              const isDeleted = entry.status === 'DELETED';
              const isChosen = entry.id === selection?.chosenEntryId;
              const isShownByDefault =
                selection?.chosenEntryId === undefined && entry.id === selection?.defaultEntryId;
              const name =
                selection === undefined ? (
                  entry.name
                ) : (
                  <Link
                    {...arrowKeySelection}
                    data-shown-by-default={isShownByDefault ? '' : undefined}
                    id={readAccountLinkId(entry.id)}
                    to={{
                      search: writeSelectedAccount({
                        searchParams,
                        accountId: entry.id,
                      }).toString(),
                    }}
                    preventScrollReset
                    aria-current={isChosen ? 'true' : undefined}
                    className={styles['nameLink']}
                  >
                    {entry.name}
                  </Link>
                );
              return (
                <li
                  key={entry.id}
                  className={`${styles['entry'] ?? ''} ${isDeleted ? (styles['deleted'] ?? '') : ''} ${isChosen || isShownByDefault ? (styles['selected'] ?? '') : ''}`}
                >
                  <span className={styles['mark']} aria-hidden="true">
                    {entry.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className={styles['identity']}>
                    {isDeleted ? (
                      <s className={styles['name']}>
                        {name}
                        <span className="visually-hidden"> (deleted)</span>
                      </s>
                    ) : (
                      <span className={styles['name']}>{name}</span>
                    )}
                    {entry.description !== undefined &&
                      entry.description !== null &&
                      entry.description !== '' && (
                        <span className={styles['description']}>{entry.description}</span>
                      )}
                  </span>
                  {renderActions(entry)}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </section>
  );
}
