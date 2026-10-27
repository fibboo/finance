import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import type { TransactionFilters } from '../api/transaction-filters';
import { amountFilterFormSchema } from '../schemas/transaction-filter-forms';
import styles from './amount-filter.module.css';
import { FilterActions } from './filter-actions';
import { FilterField } from './filter-field';

type AmountFilterFormInput = z.input<typeof amountFilterFormSchema>;
type AmountFilterFormOutput = z.output<typeof amountFilterFormSchema>;

type AmountFilterProps = Readonly<{
  filters: TransactionFilters;
  baseCurrency: string;
  onApply: (
    amounts: Pick<TransactionFilters, 'base_currency_amount_from' | 'base_currency_amount_to'>,
  ) => void;
}>;

export function AmountFilter({ filters, baseCurrency, onApply }: AmountFilterProps) {
  const { register, handleSubmit, setValue, formState } = useForm<
    AmountFilterFormInput,
    unknown,
    AmountFilterFormOutput
  >({
    resolver: zodResolver(amountFilterFormSchema),
    defaultValues: {
      base_currency_amount_from: filters.base_currency_amount_from ?? '',
      base_currency_amount_to: filters.base_currency_amount_to ?? '',
    },
  });

  return (
    <form
      className={styles['amountFilter']}
      noValidate
      onSubmit={(event) => {
        void handleSubmit(onApply)(event);
      }}
    >
      <div className={styles['amounts']}>
        <FilterField
          label={`From, ${baseCurrency}`}
          error={formState.errors.base_currency_amount_from?.message}
          input={{
            inputMode: 'decimal',
            placeholder: '0',
            ...register('base_currency_amount_from'),
          }}
        />
        <FilterField
          label={`To, ${baseCurrency}`}
          error={formState.errors.base_currency_amount_to?.message}
          input={{
            inputMode: 'decimal',
            placeholder: 'Any',
            ...register('base_currency_amount_to'),
          }}
        />
      </div>
      <p className={styles['note']}>Compared in your main currency, {baseCurrency}.</p>
      <FilterActions
        onReset={() => {
          setValue('base_currency_amount_from', '');
          setValue('base_currency_amount_to', '');
        }}
      />
    </form>
  );
}
