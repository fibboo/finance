import type { ReactNode } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';

import { readAmountInputProps } from './amount-input';
import { InputRow } from './input-row';
import styles from './transaction-form.module.css';

type BaseCurrencyAmountRowProps = Readonly<{
  baseCurrency: string;
  hint: string | undefined;
  registration: UseFormRegisterReturn;
  error: string | undefined;
  action?: ReactNode;
}>;

export function BaseCurrencyAmountRow({
  baseCurrency,
  hint,
  registration,
  error,
  action,
}: BaseCurrencyAmountRowProps) {
  return (
    <div className={styles['rows']}>
      <InputRow
        label={`In ${baseCurrency}`}
        input={readAmountInputProps({ registration, isNegativeAllowed: false })}
        suffix={
          <>
            {action}
            {baseCurrency}
          </>
        }
        hint={hint}
        error={error}
      />
    </div>
  );
}
