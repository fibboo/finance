import { useFormContext, useWatch } from 'react-hook-form';

import type { components } from '@/lib/api-schema';

import type { MovementFormValues } from '../schemas/transaction-form';
import { ForeignAmountRow } from './foreign-amount-row';
import { InputRow } from './input-row';
import styles from './transaction-form.module.css';

type DictionaryItem = components['schemas']['DictionaryItem'];
type MovementRequest = components['schemas']['MovementRequest'];

type IncomeExtraRowsProps = Readonly<{
  currencies: readonly DictionaryItem[];
  baseCurrency: string;
  isBaseCurrencyAmountAsked: boolean;
}>;

export function IncomeExtraRows({
  currencies,
  baseCurrency,
  isBaseCurrencyAmountAsked,
}: IncomeExtraRowsProps) {
  const { control, register, formState } = useFormContext<
    MovementFormValues,
    unknown,
    MovementRequest
  >();
  const isPaidInAnotherCurrency = useWatch({ control, name: 'is_paid_in_another_currency' });
  if (!isPaidInAnotherCurrency && !isBaseCurrencyAmountAsked) {
    return null;
  }

  return (
    <div className={[styles['rows'], styles['extraRows']].join(' ')}>
      {isPaidInAnotherCurrency && (
        <ForeignAmountRow
          label="Paid amount"
          currencyLabel="Paid currency"
          amountRegistration={register('source_amount')}
          currencyRegistration={register('source_currency')}
          currencies={currencies}
          amountError={formState.errors.source_amount?.message}
          currencyError={formState.errors.source_currency?.message}
        />
      )}
      {isBaseCurrencyAmountAsked && (
        <InputRow
          label={`In ${baseCurrency}`}
          input={{
            ...register('base_currency_amount'),
            inputMode: 'decimal',
            autoComplete: 'off',
            placeholder: '0.00',
          }}
          suffix={baseCurrency}
          error={formState.errors.base_currency_amount?.message}
        />
      )}
    </div>
  );
}
