import { useFormContext, useWatch } from 'react-hook-form';

import type { components } from '@/lib/api-schema';

import type { MovementFormValues } from '../schemas/transaction-form';
import { ForeignAmountRow } from './foreign-amount-row';
import { readEnteredRate } from './movement-config';

type DictionaryItem = components['schemas']['DictionaryItem'];
type MovementRequest = components['schemas']['MovementRequest'];

type ExpenseExtraRowsProps = Readonly<{
  currencies: readonly DictionaryItem[];
  accountCurrency: string | undefined;
}>;

export function ExpenseExtraRows({ currencies, accountCurrency }: ExpenseExtraRowsProps) {
  const { control, register, formState } = useFormContext<
    MovementFormValues,
    unknown,
    MovementRequest
  >();
  const [isPaidInAnotherCurrency, amountText, currency, referenceText] = useWatch({
    control,
    name: [
      'is_paid_in_another_currency',
      'destination_amount',
      'destination_currency',
      'source_amount',
    ],
  });
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
      hint={
        accountCurrency === undefined || currency === '' || currency === accountCurrency
          ? undefined
          : readEnteredRate({ amountText, referenceText, currency })
      }
      amountError={formState.errors.destination_amount?.message}
      currencyError={formState.errors.destination_currency?.message}
    />
  );
}
