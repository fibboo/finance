import { useId } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';

import styles from './select-field.module.css';

type SelectFieldOption = Readonly<{ value: string; label: string }>;

type SelectFieldProps = Readonly<{
  label: string;
  registration: UseFormRegisterReturn;
  options: readonly SelectFieldOption[];
  error?: string | undefined;
}>;

export function SelectField({ label, registration, options, error }: SelectFieldProps) {
  const selectId = useId();
  return (
    <div className={styles['selectField']}>
      <label htmlFor={selectId} className={styles['label']}>
        {label}
      </label>
      <div className={styles['control']}>
        <select
          {...registration}
          id={selectId}
          className={styles['select']}
          aria-invalid={error !== undefined}
          aria-describedby={error === undefined ? undefined : `${selectId}-error`}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {error !== undefined && (
        <p id={`${selectId}-error`} role="alert" className={styles['error']}>
          {error}
        </p>
      )}
    </div>
  );
}
