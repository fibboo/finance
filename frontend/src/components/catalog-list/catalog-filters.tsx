import { useId } from 'react';

import styles from './catalog-filters.module.css';

type CatalogSegment<Key extends string> = Readonly<{
  legend: string;
  options: readonly Readonly<{ key: Key; label: string }>[];
  chosenKey: Key | undefined;
  onChoose: (key: Key | undefined) => void;
}>;

type CatalogFiltersProps<Key extends string> = Readonly<{
  segment: CatalogSegment<Key> | undefined;
  isDeletedShown: boolean;
  onDeletedShownChange: (isDeletedShown: boolean) => void;
}>;

export function CatalogFilters<Key extends string>({
  segment,
  isDeletedShown,
  onDeletedShownChange,
}: CatalogFiltersProps<Key>) {
  const name = useId();
  return (
    <div className={styles['catalogFilters']}>
      {segment !== undefined && (
        <fieldset className={styles['segment']}>
          <legend className="visually-hidden">{segment.legend}</legend>
          {[{ key: undefined, label: 'All' }, ...segment.options].map((option) => (
            <label key={option.key ?? 'ALL'} className={styles['option']}>
              <input
                type="radio"
                name={name}
                className={styles['input']}
                checked={segment.chosenKey === option.key}
                onChange={() => {
                  segment.onChoose(option.key);
                }}
              />
              {option.label}
            </label>
          ))}
        </fieldset>
      )}
      <label className={styles['toggle']}>
        <input
          type="checkbox"
          role="switch"
          className={styles['switch']}
          checked={isDeletedShown}
          onChange={(event) => {
            onDeletedShownChange(event.target.checked);
          }}
        />
        Deleted
      </label>
    </div>
  );
}
