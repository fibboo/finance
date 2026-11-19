import { type ComponentProps, type ReactNode, useId } from 'react';

import styles from './input-row.module.css';

type InputRowProps = Readonly<{
  label: string;
  input: ComponentProps<'input'>;
  suffix?: ReactNode;
  action?: ReactNode;
  hint?: string | undefined;
  error: string | undefined;
}>;

export function InputRow({ label, input, suffix, action, hint, error }: InputRowProps) {
  const inputId = useId();
  const descriptionId = useId();
  const description = error ?? hint;
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
          aria-describedby={description === undefined ? undefined : descriptionId}
        />
        {suffix !== undefined && <span className={styles['suffix']}>{suffix}</span>}
        {action}
      </span>
      {description !== undefined && (
        <span id={descriptionId} className={error === undefined ? styles['hint'] : styles['error']}>
          {description}
        </span>
      )}
    </div>
  );
}
