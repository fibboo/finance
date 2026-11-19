import { useFormContext, useWatch } from 'react-hook-form';

import type { components } from '@/lib/api-schema';

import type { MovementFormValues } from '../schemas/transaction-form';
import { ForeignAmountRow } from './foreign-amount-row';
import { readEnteredRate } from './movement-config';

type DictionaryItem = components['schemas']['DictionaryItem'];
type MovementRequest = components['schemas']['MovementRequest'];

type IncomeExtraRowsProps = Readonly<{
  currencies: readonly DictionaryItem[];
  accountCurrency: string | undefined;
}>;

export function IncomeExtraRows({ currencies, accountCurrency }: IncomeExtraRowsProps) {
  const { control, register, formState } = useFormContext<
    MovementFormValues,
    unknown,
    MovementRequest
  >();
  const [isPaidInAnotherCurrency, amountText, currency, referenceText] = useWatch({
    control,
    name: ['is_paid_in_another_currency', 'source_amount', 'source_currency', 'destination_amount'],
  });
  if (!isPaidInAnotherCurrency) {
    return null;
  }

  return (
    <ForeignAmountRow
      label="Original amount"
      currencyLabel="Paid currency"
      amountRegistration={register('source_amount')}
      currencyRegistration={register('source_currency')}
      currencies={currencies}
      hint={
        accountCurrency === undefined || currency === '' || currency === accountCurrency
          ? undefined
          : readEnteredRate({ amountText, referenceText, currency })
      }
      amountError={formState.errors.source_amount?.message}
      currencyError={formState.errors.source_currency?.message}
    />
  );
}
