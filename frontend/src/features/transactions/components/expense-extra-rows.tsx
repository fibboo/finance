import { useFormContext, useWatch } from 'react-hook-form';

import type { components } from '@/lib/api-schema';

import type { MovementFormValues } from '../schemas/transaction-form';
import { ForeignAmountRow } from './foreign-amount-row';

type DictionaryItem = components['schemas']['DictionaryItem'];
type MovementRequest = components['schemas']['MovementRequest'];

type ExpenseExtraRowsProps = Readonly<{ currencies: readonly DictionaryItem[] }>;

export function ExpenseExtraRows({ currencies }: ExpenseExtraRowsProps) {
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
    <ForeignAmountRow
      label="Original amount"
      currencyLabel="Seller’s currency"
      amountRegistration={register('destination_amount')}
      currencyRegistration={register('destination_currency')}
      currencies={currencies}
      amountError={formState.errors.destination_amount?.message}
      currencyError={formState.errors.destination_currency?.message}
    />
  );
}
