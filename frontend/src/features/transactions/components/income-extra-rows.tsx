import { useFormContext, useWatch } from 'react-hook-form';

import { AmountCalculator } from '@/components/amount-calculator/amount-calculator';
import type { components } from '@/lib/api-schema';

import type { MovementFormValues } from '../schemas/transaction-form';
import { ForeignAmountRow } from './foreign-amount-row';
import { readExchangeRateEquation } from './movement-config';

type DictionaryItem = components['schemas']['DictionaryItem'];
type MovementRequest = components['schemas']['MovementRequest'];

type IncomeExtraRowsProps = Readonly<{
  currencies: readonly DictionaryItem[];
  accountCurrency: string | undefined;
}>;

export function IncomeExtraRows({ currencies, accountCurrency }: IncomeExtraRowsProps) {
  const { control, register, setValue, formState } = useFormContext<
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
      action={
        <AmountCalculator
          label="original amount"
          value={amountText}
          currency={currency === '' ? undefined : currency}
          onApply={(amount) => {
            setValue('source_amount', amount, { shouldDirty: true, shouldValidate: true });
          }}
        />
      }
      label="Original amount"
      currencyLabel="Paid currency"
      amountRegistration={register('source_amount')}
      currencyRegistration={register('source_currency')}
      currencies={currencies}
      hint={readExchangeRateEquation({
        amountText,
        currency,
        referenceText,
        referenceCurrency: accountCurrency,
      })}
      amountError={formState.errors.source_amount?.message}
      currencyError={formState.errors.source_currency?.message}
    />
  );
}
