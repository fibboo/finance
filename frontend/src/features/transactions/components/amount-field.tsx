import { useId } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';

import styles from './amount-field.module.css';

type AmountFieldProps = Readonly<{
  label: string;
  registration: UseFormRegisterReturn;
  currency: string | undefined;
  hint: string | undefined;
  error: string | undefined;
}>;

export function AmountField({ label, registration, currency, hint, error }: AmountFieldProps) {
  const inputId = useId();
  const hintId = useId();
  return (
    <div className={styles['amountField']}>
      <label htmlFor={inputId} className={styles['label']}>
        {label}
      </label>
      <span className={styles['control']}>
        <input
          {...registration}
          id={inputId}
          className={styles['input']}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          aria-invalid={error !== undefined}
          aria-describedby={hintId}
        />
        {currency !== undefined && <span className={styles['currency']}>{currency}</span>}
      </span>
      <span id={hintId} className={error === undefined ? styles['hint'] : styles['error']}>
        {error ?? hint}
      </span>
    </div>
  );
}
