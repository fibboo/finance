import type { UseFormRegisterReturn } from 'react-hook-form';

import { readAmountInputProps } from './amount-input';
import { InputRow } from './input-row';
import styles from './transaction-form.module.css';

type BaseCurrencyAmountRowProps = Readonly<{
  baseCurrency: string;
  registration: UseFormRegisterReturn;
  error: string | undefined;
}>;

export function BaseCurrencyAmountRow({
  baseCurrency,
  registration,
  error,
}: BaseCurrencyAmountRowProps) {
  return (
    <div className={styles['rows']}>
      <InputRow
        label={`In ${baseCurrency}`}
        input={readAmountInputProps({ registration, isNegativeAllowed: false })}
        suffix={baseCurrency}
        error={error}
      />
    </div>
  );
}
