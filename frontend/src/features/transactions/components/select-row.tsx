import { type ComponentProps, useId } from 'react';

import styles from './select-row.module.css';

const CHEVRON_ICON_PATH = 'm9 6 6 6-6 6';

type SelectRowOption = Readonly<{ value: string; label: string }>;

type SelectRowProps = Readonly<{
  label: string;
  select: ComponentProps<'select'>;
  options: readonly SelectRowOption[];
  error: string | undefined;
}>;

export function SelectRow({ label, select, options, error }: SelectRowProps) {
  const selectId = useId();
  const errorId = useId();
  return (
    <div className={styles['selectRow']}>
      <span className={styles['control']}>
        <label htmlFor={selectId} className={styles['label']}>
          {label}
        </label>
        <select
          {...select}
          id={selectId}
          className={styles['select']}
          aria-invalid={error !== undefined}
          aria-describedby={error === undefined ? undefined : errorId}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <svg className={styles['chevron']} aria-hidden="true" viewBox="0 0 24 24">
          <path d={CHEVRON_ICON_PATH} />
        </svg>
      </span>
      {error !== undefined && (
        <span id={errorId} className={styles['error']}>
          {error}
        </span>
      )}
    </div>
  );
}
