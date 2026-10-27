import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import type { components } from '@/lib/api-schema';

import type { TransactionFilters } from '../api/transaction-filters';
import { typeFilterFormSchema } from '../schemas/transaction-filter-forms';
import { FilterActions } from './filter-actions';
import styles from './type-filter.module.css';

type DictionaryItem = components['schemas']['DictionaryItem'];
type TypeFilterFormInput = z.input<typeof typeFilterFormSchema>;
type TypeFilterFormOutput = z.output<typeof typeFilterFormSchema>;

type TypeFilterProps = Readonly<{
  filters: TransactionFilters;
  transactionTypes: readonly DictionaryItem[];
  onApply: (types: Pick<TransactionFilters, 'transaction_types'>) => void;
}>;

export function TypeFilter({ filters, transactionTypes, onApply }: TypeFilterProps) {
  const { register, handleSubmit, setValue } = useForm<
    TypeFilterFormInput,
    unknown,
    TypeFilterFormOutput
  >({
    resolver: zodResolver(typeFilterFormSchema),
    defaultValues: { transaction_types: [...filters.transaction_types] },
  });

  return (
    <form
      className={styles['typeFilter']}
      noValidate
      onSubmit={(event) => {
        void handleSubmit(onApply)(event);
      }}
    >
      <fieldset className={styles['types']}>
        <legend className="visually-hidden">Types</legend>
        {transactionTypes.map((transactionType) => (
          <label key={transactionType.key} className={styles['type']}>
            <input
              type="checkbox"
              className={styles['checkbox']}
              value={transactionType.key}
              {...register('transaction_types')}
            />
            {transactionType.label}
          </label>
        ))}
      </fieldset>
      <p className={styles['note']}>None checked shows every type.</p>
      <FilterActions
        onReset={() => {
          setValue('transaction_types', []);
        }}
      />
    </form>
  );
}
