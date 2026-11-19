import { type ComponentProps, type ReactNode, useId } from 'react';

import styles from './filter-field.module.css';

type FilterFieldProps = Readonly<{
  label: string;
  error: string | undefined;
  input: ComponentProps<'input'>;
  action?: ReactNode;
  suffix?: ReactNode;
}>;

export function FilterField({ label, error, input, action, suffix }: FilterFieldProps) {
  const inputId = useId();
  const errorId = useId();
  return (
    <div className={styles['filterField']}>
      <label htmlFor={inputId}>{label}</label>
      <span className={suffix === undefined ? styles['control'] : styles['controlWithSuffix']}>
        <input
          {...input}
          id={inputId}
          className={
            suffix !== undefined
              ? styles['inputWithSuffix']
              : action === undefined
                ? styles['input']
                : styles['inputWithAction']
          }
          aria-invalid={error !== undefined}
          aria-describedby={error === undefined ? undefined : errorId}
        />
        {suffix}
        {action}
      </span>
      {error !== undefined && (
        <span id={errorId} className={styles['error']}>
          {error}
        </span>
      )}
    </div>
  );
}
