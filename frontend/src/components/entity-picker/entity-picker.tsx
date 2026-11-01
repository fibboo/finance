import { useState } from 'react';

import { Skeleton } from '@/components/skeleton/skeleton';
import { listSkeletonKeys } from '@/components/skeleton/skeleton-keys';

import styles from './entity-picker.module.css';

const BACK_ICON_PATH = 'm15 6-6 6 6 6';
const SEARCH_ICON_PATH = 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14m9 16-3.5-3.5';
const CHECK_ICON_PATH = 'm5 12 5 5 9-10';
const SKELETON_ROW_COUNT = 4;

export type EntityPickerItem = Readonly<{
  id: string;
  name: string;
  color: string;
  note: string;
}>;

type EntityPickerProps = Readonly<{
  title: string;
  searchLabel: string;
  emptyText: string;
  items: readonly EntityPickerItem[] | undefined;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  onBack: () => void;
}>;

export function EntityPicker({
  title,
  searchLabel,
  emptyText,
  items,
  selectedId,
  onSelect,
  onBack,
}: EntityPickerProps) {
  const [search, setSearch] = useState('');
  const searchText = search.trim().toLowerCase();
  const matchingItems = items?.filter((item) => item.name.toLowerCase().includes(searchText));

  return (
    <div className={styles['entityPicker']}>
      <div className={styles['header']}>
        <button type="button" className={styles['back']} aria-label="Back" onClick={onBack}>
          <svg className={styles['icon']} aria-hidden="true" viewBox="0 0 24 24">
            <path d={BACK_ICON_PATH} />
          </svg>
        </button>
        <h2 className={styles['title']}>{title}</h2>
      </div>
      <label className={styles['search']}>
        <svg className={styles['searchIcon']} aria-hidden="true" viewBox="0 0 24 24">
          <path d={SEARCH_ICON_PATH} />
        </svg>
        <span className="visually-hidden">{searchLabel}</span>
        <input
          ref={(input) => {
            input?.focus({ preventScroll: true });
          }}
          type="search"
          className={styles['searchInput']}
          placeholder="Search"
          autoComplete="off"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
          }}
        />
      </label>
      {matchingItems === undefined ? (
        <ul className={styles['list']} aria-busy="true" aria-label={title}>
          {listSkeletonKeys(SKELETON_ROW_COUNT).map((key) => (
            <li key={key} className={styles['skeletonRow']}>
              <Skeleton className={styles['skeletonName']} />
            </li>
          ))}
        </ul>
      ) : matchingItems.length > 0 ? (
        <ul className={styles['list']} aria-label={title}>
          {matchingItems.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={styles['item']}
                aria-pressed={item.id === selectedId}
                onClick={() => {
                  onSelect(item.id);
                }}
              >
                <span
                  className={styles['mark']}
                  style={{ backgroundColor: item.color }}
                  aria-hidden="true"
                />
                <span className={styles['name']}>{item.name}</span>
                <span className={styles['note']}>{item.note}</span>
                {item.id === selectedId && (
                  <svg className={styles['check']} aria-hidden="true" viewBox="0 0 24 24">
                    <path d={CHECK_ICON_PATH} />
                  </svg>
                )}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles['empty']}>
          {searchText === '' ? emptyText : `Nothing matches “${search.trim()}”.`}
        </p>
      )}
    </div>
  );
}
