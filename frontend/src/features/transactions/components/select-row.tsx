import { useId } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';

import styles from './select-row.module.css';

const CHEVRON_ICON_PATH = 'm9 6 6 6-6 6';

type SelectRowOption = Readonly<{ value: string; label: string }>;

type SelectRowProps = Readonly<{
  label: string;
  registration: UseFormRegisterReturn;
  options: readonly SelectRowOption[];
}>;

export function SelectRow({ label, registration, options }: SelectRowProps) {
  const selectId = useId();
  return (
    <span className={styles['selectRow']}>
      <label htmlFor={selectId} className={styles['label']}>
        {label}
      </label>
      <select {...registration} id={selectId} className={styles['select']}>
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
  );
}
