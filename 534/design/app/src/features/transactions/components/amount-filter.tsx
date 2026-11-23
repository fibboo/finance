import { zodResolver } from '@hookform/resolvers/zod';
import { type Ref, useImperativeHandle } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';

import { AmountCalculator } from '@/components/amount-calculator/amount-calculator';
import { useDebouncedAction } from '@/hooks/use-debounced-value';
import { formatAmountText } from '@/lib/amount-input';

import type { TransactionFilters } from '../api/transaction-filters';
import { amountFilterFormSchema } from '../schemas/transaction-filter-forms';
import styles from './amount-filter.module.css';
import { readAmountInputProps } from './amount-input';
import { FilterField } from './filter-field';
import type { PendingFilter } from './pending-filter';

type AmountFilterFormInput = z.input<typeof amountFilterFormSchema>;
type AmountFilterFormOutput = z.output<typeof amountFilterFormSchema>;

type AmountFilterProps = Readonly<{
  ref?: Ref<PendingFilter>;
  filters: TransactionFilters;
  baseCurrency: string;
  onApply: (
    amounts: Pick<TransactionFilters, 'base_currency_amount_from' | 'base_currency_amount_to'>,
  ) => void;
}>;

export function AmountFilter({ ref, filters, baseCurrency, onApply }: AmountFilterProps) {
  const { register, handleSubmit, getValues, setValue, control, formState } = useForm<
    AmountFilterFormInput,
    unknown,
    AmountFilterFormOutput
  >({
    resolver: zodResolver(amountFilterFormSchema),
    values: {
      base_currency_amount_from: formatAmountText(filters.base_currency_amount_from ?? ''),
      base_currency_amount_to: formatAmountText(filters.base_currency_amount_to ?? ''),
    },
  });

  const [amountFrom, amountTo] = useWatch({
    control,
    name: ['base_currency_amount_from', 'base_currency_amount_to'],
  });
  const { schedule, cancel } = useDebouncedAction(() => {
    void handleSubmit(onApply)();
  });
  useImperativeHandle(ref, () => ({
    readPendingChange() {
      if (!cancel()) {
        return undefined;
      }
      const amounts = amountFilterFormSchema.safeParse(getValues());
      const change = amounts.success ? { filters: amounts.data } : undefined;
      return change;
    },
  }));

  return (
    <form
      className={styles['amountFilter']}
      noValidate
      onChange={schedule}
      onSubmit={(event) => {
        void handleSubmit(onApply)(event);
      }}
    >
      <div className={styles['amounts']}>
        <FilterField
          label={`From, ${baseCurrency}`}
          suffix={
            <AmountCalculator
              label="lower bound"
              value={amountFrom}
              currency={baseCurrency}
              onApply={(amount) => {
                setValue('base_currency_amount_from', amount, {
                  shouldDirty: true,
                  shouldValidate: true,
                });
                schedule();
              }}
            />
          }
          error={formState.errors.base_currency_amount_from?.message}
          input={{
            ...readAmountInputProps({
              registration: register('base_currency_amount_from'),
              isNegativeAllowed: false,
            }),
            value: amountFrom,
            placeholder: '0',
          }}
        />
        <FilterField
          label={`To, ${baseCurrency}`}
          suffix={
            <AmountCalculator
              label="upper bound"
              value={amountTo}
              currency={baseCurrency}
              onApply={(amount) => {
                setValue('base_currency_amount_to', amount, {
                  shouldDirty: true,
                  shouldValidate: true,
                });
                schedule();
              }}
            />
          }
          error={formState.errors.base_currency_amount_to?.message}
          input={{
            ...readAmountInputProps({
              registration: register('base_currency_amount_to'),
              isNegativeAllowed: false,
            }),
            value: amountTo,
            placeholder: 'Any',
          }}
        />
      </div>
      <p className={styles['note']}>Compared in your main currency, {baseCurrency}.</p>
    </form>
  );
}
