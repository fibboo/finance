import { useId } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';

import type { components } from '@/lib/api-schema';

import styles from './foreign-amount-row.module.css';
import { InputRow } from './input-row';

type DictionaryItem = components['schemas']['DictionaryItem'];

type ForeignAmountRowProps = Readonly<{
  label: string;
  currencyLabel: string;
  amountRegistration: UseFormRegisterReturn;
  currencyRegistration: UseFormRegisterReturn;
  currencies: readonly DictionaryItem[];
  amountError: string | undefined;
  currencyError: string | undefined;
}>;

export function ForeignAmountRow({
  label,
  currencyLabel,
  amountRegistration,
  currencyRegistration,
  currencies,
  amountError,
  currencyError,
}: ForeignAmountRowProps) {
  const currencyErrorId = useId();
  return (
    <div>
      <InputRow
        label={label}
        input={{
          ...amountRegistration,
          inputMode: 'decimal',
          autoComplete: 'off',
          placeholder: '0.00',
        }}
        suffix={
          <select
            {...currencyRegistration}
            className={styles['currencySelect']}
            aria-label={currencyLabel}
            aria-invalid={currencyError !== undefined}
            aria-describedby={currencyError === undefined ? undefined : currencyErrorId}
          >
            <option value="">Currency</option>
            {currencies.map((currency) => (
              <option key={currency.key} value={currency.key}>
                {currency.key}
              </option>
            ))}
          </select>
        }
        error={amountError}
      />
      {currencyError !== undefined && (
        <span id={currencyErrorId} className={styles['fieldError']}>
          {currencyError}
        </span>
      )}
    </div>
  );
}
