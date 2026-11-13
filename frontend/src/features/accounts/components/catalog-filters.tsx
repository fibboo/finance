import { useId } from 'react';

import type {
  CatalogFilters as CatalogFilterValues,
  CategoryTypeOption,
} from '../api/catalog-filters';
import styles from './catalog-filters.module.css';

type CatalogFiltersProps = Readonly<{
  categoryTypes: readonly CategoryTypeOption[] | undefined;
  filters: CatalogFilterValues;
  onChange: (filters: CatalogFilterValues) => void;
}>;

export function CatalogFilters({ categoryTypes, filters, onChange }: CatalogFiltersProps) {
  const name = useId();
  return (
    <div className={styles['catalogFilters']}>
      {categoryTypes !== undefined && (
        <fieldset className={styles['segment']}>
          <legend className="visually-hidden">Category type</legend>
          {[{ key: undefined, label: 'All' }, ...categoryTypes].map((option) => (
            <label key={option.key ?? 'ALL'} className={styles['option']}>
              <input
                type="radio"
                name={name}
                className={styles['input']}
                checked={filters.categoryType === option.key}
                onChange={() => {
                  onChange({ ...filters, categoryType: option.key });
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
          checked={filters.isDeletedShown}
          onChange={(event) => {
            onChange({ ...filters, isDeletedShown: event.target.checked });
          }}
        />
        Deleted
      </label>
    </div>
  );
}
