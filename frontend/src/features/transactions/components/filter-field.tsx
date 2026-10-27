import { type ComponentProps, type ReactNode, useId } from 'react';

import styles from './filter-field.module.css';

type FilterFieldProps = Readonly<{
  label: string;
  error: string | undefined;
  input: ComponentProps<'input'>;
  action?: ReactNode;
}>;

export function FilterField({ label, error, input, action }: FilterFieldProps) {
  const inputId = useId();
  const errorId = useId();
  return (
    <div className={styles['filterField']}>
      <label htmlFor={inputId}>{label}</label>
      <span className={styles['control']}>
        <input
          {...input}
          id={inputId}
          className={action === undefined ? styles['input'] : styles['inputWithAction']}
          aria-invalid={error !== undefined}
          aria-describedby={error === undefined ? undefined : errorId}
        />
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
