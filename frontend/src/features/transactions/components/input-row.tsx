import { type ComponentProps, type ReactNode, useId } from 'react';

import styles from './input-row.module.css';

type InputRowProps = Readonly<{
  label: string;
  input: ComponentProps<'input'>;
  suffix?: ReactNode;
  action?: ReactNode;
  error: string | undefined;
}>;

export function InputRow({ label, input, suffix, action, error }: InputRowProps) {
  const inputId = useId();
  const errorId = useId();
  return (
    <div className={styles['inputRow']}>
      <span className={action === undefined ? styles['control'] : styles['controlWithAction']}>
        <label htmlFor={inputId} className={styles['label']}>
          {label}
        </label>
        <input
          {...input}
          id={inputId}
          className={styles['input']}
          aria-invalid={error !== undefined}
          aria-describedby={error === undefined ? undefined : errorId}
        />
        {suffix !== undefined && <span className={styles['suffix']}>{suffix}</span>}
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
