import { type ReactNode, useId } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';

import styles from './amount-field.module.css';
import { readAmountInputProps } from './amount-input';
import type { BaseCurrencyHint } from './movement-config';

type AmountFieldProps = Readonly<{
  label: string;
  registration: UseFormRegisterReturn;
  isNegativeAllowed: boolean;
  currency: string | undefined;
  balanceHint?: string | undefined;
  baseCurrencyHint: BaseCurrencyHint | undefined;
  error: string | undefined;
  action?: ReactNode;
}>;

export function AmountField({
  label,
  registration,
  isNegativeAllowed,
  currency,
  balanceHint,
  baseCurrencyHint,
  error,
  action,
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
        {action}
        {currency !== undefined && <span className={styles['currency']}>{currency}</span>}
      </span>
      <span id={hintId} className={error === undefined ? styles['hint'] : styles['error']}>
        {error ?? (
          <>
            {balanceHint}
            {baseCurrencyHint !== undefined && (
              <>
                {balanceHint !== undefined && ' · '}≈ {baseCurrencyHint.amount} ·{' '}
                <span className={styles['rate']}>rate {baseCurrencyHint.rate}</span>
              </>
            )}
          </>
        )}
      </span>
    </div>
  );
}
