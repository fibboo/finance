import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';

import { toDateText } from '@/lib/format-date';

import type { TransactionFilters } from '../api/transaction-filters';
import { createPeriodFilterFormSchema } from '../schemas/transaction-filter-forms';
import { DateField } from './date-field';
import { FilterActions } from './filter-actions';
import styles from './period-filter.module.css';
import { readRecentMonths } from './recent-months';

type PeriodFilterFormSchema = ReturnType<typeof createPeriodFilterFormSchema>;
type PeriodFilterFormInput = z.input<PeriodFilterFormSchema>;
type PeriodFilterFormOutput = z.output<PeriodFilterFormSchema>;

type PeriodFilterProps = Readonly<{
  filters: TransactionFilters;
  today: string;
  anchorDate: string | undefined;
  isJumpAvailable: boolean;
  onJump: (monthEnd: string) => void;
  onApply: (period: Pick<TransactionFilters, 'date_from'>, jumpDate: string | undefined) => void;
}>;

export function PeriodFilter({
  filters,
  today,
  anchorDate,
  isJumpAvailable,
  onJump,
  onApply,
}: PeriodFilterProps) {
  const { register, handleSubmit, setValue, control, formState } = useForm<
    PeriodFilterFormInput,
    unknown,
    PeriodFilterFormOutput
  >({
    resolver: zodResolver(createPeriodFilterFormSchema(today)),
    defaultValues: {
      date_from: filters.date_from === undefined ? '' : toDateText(filters.date_from),
      date_to: toDateText(anchorDate ?? today),
    },
  });
  const [dateFrom, dateTo] = useWatch({ control, name: ['date_from', 'date_to'] });

  return (
    <form
      className={styles['periodFilter']}
      noValidate
      onSubmit={(event) => {
        void handleSubmit((values) => {
          onApply(
            { date_from: values.date_from === '' ? undefined : values.date_from },
            values.date_to === undefined || values.date_to === '' || values.date_to === today
              ? undefined
              : values.date_to,
          );
        })(event);
      }}
    >
      <div role="group" aria-label="Jump to a month" className={styles['months']}>
        {readRecentMonths(today).map((month) => (
          <button
            key={month.month_end}
            type="button"
            className={styles['month']}
            disabled={!isJumpAvailable}
            onClick={() => {
              onJump(month.month_end);
            }}
          >
            {month.label}
          </button>
        ))}
      </div>
      {!isJumpAvailable && (
        <p className={styles['note']}>Months and To jump with Newest first only.</p>
      )}
      <div className={styles['dates']}>
        <DateField
          label="From"
          error={formState.errors.date_from?.message}
          registration={register('date_from')}
          value={dateFrom}
          max={today}
          onPick={(dateText) => {
            setValue('date_from', dateText, { shouldValidate: formState.isSubmitted });
          }}
        />
        <DateField
          label="To"
          error={formState.errors.date_to?.message}
          registration={register('date_to', { disabled: !isJumpAvailable })}
          value={dateTo ?? ''}
          isDisabled={!isJumpAvailable}
          max={today}
          onPick={(dateText) => {
            setValue('date_to', dateText, { shouldValidate: formState.isSubmitted });
          }}
        />
      </div>
      <FilterActions
        onReset={() => {
          setValue('date_from', '');
          setValue('date_to', toDateText(today));
        }}
      />
    </form>
  );
}
