import { useId } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';

import styles from './select-field.module.css';

type SelectFieldOption = Readonly<{ value: string; label: string }>;

type SelectFieldProps = Readonly<{
  label: string;
  registration: UseFormRegisterReturn;
  options: readonly SelectFieldOption[];
}>;

export function SelectField({ label, registration, options }: SelectFieldProps) {
  const selectId = useId();
  return (
    <div className={styles['selectField']}>
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
    </div>
  );
}
