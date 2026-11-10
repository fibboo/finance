import { useId } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';

import styles from './amount-field.module.css';
import { readAmountInputProps } from './amount-input';

type AmountFieldProps = Readonly<{
  label: string;
  registration: UseFormRegisterReturn;
  isNegativeAllowed: boolean;
  currency: string | undefined;
  hint: string | undefined;
  error: string | undefined;
}>;

export function AmountField({
  label,
  registration,
  isNegativeAllowed,
  currency,
  hint,
  error,
}: AmountFieldProps) {
  const inputId = useId();
  const hintId = useId();
  return (
    <div className={styles['amountField']}>
      <label htmlFor={inputId} className={styles['label']}>
        {label}
      </label>
      <span className={styles['control']}>
        <input
          {...readAmountInputProps({ registration, isNegativeAllowed })}
          id={inputId}
          className={styles['input']}
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
