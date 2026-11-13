import { type ReactNode, useId } from 'react';
import { Link, type To } from 'react-router';

import { Skeleton } from '@/components/skeleton/skeleton';
import { listSkeletonKeys } from '@/components/skeleton/skeleton-keys';
import { useArrowKeySelection } from '@/hooks/use-arrow-key-selection';

import type { CatalogEntry, CatalogGroup } from './catalog-entry';
import styles from './catalog-list.module.css';

const ENTRY_SKELETON_COUNT = 4;

type CatalogSelection = Readonly<{
  chosenEntryId: string | undefined;
  defaultEntryId: string | undefined;
  readEntryLink: (entryId: string) => To;
  readEntryLinkId: (entryId: string) => string;
}>;

type CatalogListProps<Entry extends CatalogEntry> = Readonly<{
  label: string;
  groups: readonly CatalogGroup<Entry>[] | undefined;
  selection: CatalogSelection | undefined;
  renderMark: (entry: Entry) => ReactNode;
  renderActions: (entry: Entry) => ReactNode;
}>;

export function CatalogList<Entry extends CatalogEntry>({
  label,
  groups,
  selection,
  renderMark,
  renderActions,
}: CatalogListProps<Entry>) {
  const headingId = useId();
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
          aria-labelledby={group.heading === undefined ? undefined : `${headingId}-${group.key}`}
        >
          {group.heading !== undefined && (
            <div className={styles['groupHeader']}>
              <h2 id={`${headingId}-${group.key}`} className={styles['groupHeading']}>
                {group.heading}
              </h2>
              <span className={styles['groupCount']}>{group.entries.length}</span>
            </div>
          )}
          <ul className={styles['entries']}>
            {group.entries.map((entry) => {
              const isDeleted = entry.status === 'DELETED';
              const isChosen = entry.id === selection?.chosenEntryId;
              const isShownByDefault =
                selection?.chosenEntryId === undefined && entry.id === selection?.defaultEntryId;
              const deletedNote = isDeleted ? (
                <>
                  {' '}
                  <span className="visually-hidden">(deleted)</span>
                </>
              ) : null;
              const name =
                selection === undefined ? (
                  <>
                    {entry.name}
                    {deletedNote}
                  </>
                ) : (
                  <Link
                    {...arrowKeySelection}
                    data-shown-by-default={isShownByDefault ? '' : undefined}
                    id={selection.readEntryLinkId(entry.id)}
                    to={selection.readEntryLink(entry.id)}
                    preventScrollReset
                    aria-current={isChosen ? 'true' : undefined}
                    className={styles['nameLink']}
                  >
                    {entry.name}
                    {deletedNote}
                  </Link>
                );
              return (
                <li
                  key={entry.id}
                  className={`${styles['entry'] ?? ''} ${isDeleted ? (styles['deleted'] ?? '') : ''} ${isChosen || isShownByDefault ? (styles['selected'] ?? '') : ''}`}
                >
                  <span className={styles['mark']} aria-hidden="true">
                    {renderMark(entry)}
                  </span>
                  <span className={styles['identity']}>
                    {isDeleted ? (
                      <s className={styles['name']}>{name}</s>
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
