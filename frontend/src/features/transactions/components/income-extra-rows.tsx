import { useFormContext, useWatch } from 'react-hook-form';

import type { components } from '@/lib/api-schema';

import type { MovementFormValues } from '../schemas/transaction-form';
import { ForeignAmountRow } from './foreign-amount-row';
import styles from './transaction-form.module.css';

type DictionaryItem = components['schemas']['DictionaryItem'];
type MovementRequest = components['schemas']['MovementRequest'];

type IncomeExtraRowsProps = Readonly<{
  currencies: readonly DictionaryItem[];
}>;

export function IncomeExtraRows({ currencies }: IncomeExtraRowsProps) {
  const { control, register, formState } = useFormContext<
    MovementFormValues,
    unknown,
    MovementRequest
  >();
  const isPaidInAnotherCurrency = useWatch({ control, name: 'is_paid_in_another_currency' });
  if (!isPaidInAnotherCurrency) {
    return null;
  }

  return (
    <div className={[styles['rows'], styles['extraRows']].join(' ')}>
      <ForeignAmountRow
        label="Paid amount"
        currencyLabel="Paid currency"
        amountRegistration={register('source_amount')}
        currencyRegistration={register('source_currency')}
        currencies={currencies}
        amountError={formState.errors.source_amount?.message}
        currencyError={formState.errors.source_currency?.message}
      />
    </div>
  );
}
