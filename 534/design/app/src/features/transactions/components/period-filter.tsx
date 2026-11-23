import { zodResolver } from '@hookform/resolvers/zod';
import { type Ref, useImperativeHandle } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';

import { useDebouncedAction } from '@/hooks/use-debounced-value';
import { toDateText } from '@/lib/format-date';

import type { TransactionFilters } from '../api/transaction-filters';
import { createPeriodFilterFormSchema } from '../schemas/transaction-filter-forms';
import { DateField } from './date-field';
import styles from './period-filter.module.css';
import { readRecentMonths } from './recent-months';
import type { PendingFilter, PendingFilterChange } from './pending-filter';

type PeriodFilterFormSchema = ReturnType<typeof createPeriodFilterFormSchema>;
type PeriodFilterFormInput = z.input<PeriodFilterFormSchema>;
type PeriodFilterFormOutput = z.output<PeriodFilterFormSchema>;

type PeriodFilterProps = Readonly<{
  ref?: Ref<PendingFilter>;
  filters: TransactionFilters;
  today: string;
  anchorDate: string | undefined;
  isJumpAvailable: boolean;
  onJump: (monthEnd: string) => void;
  onApply: (period: Pick<TransactionFilters, 'date_from'>, jumpDate: string | undefined) => void;
}>;

function readPeriodChange({
  values,
  today,
}: Readonly<{ values: PeriodFilterFormOutput; today: string }>): PendingFilterChange {
  const change = {
    filters: { date_from: values.date_from === '' ? undefined : values.date_from },
    jumpDate:
      values.date_to === undefined || values.date_to === '' || values.date_to === today
        ? undefined
        : values.date_to,
  };
  return change;
}

export function PeriodFilter({
  ref,
  filters,
  today,
  anchorDate,
  isJumpAvailable,
  onJump,
  onApply,
}: PeriodFilterProps) {
  const { register, handleSubmit, getValues, setValue, control, formState } = useForm<
    PeriodFilterFormInput,
    unknown,
    PeriodFilterFormOutput
  >({
    resolver: zodResolver(createPeriodFilterFormSchema(today)),
    values: {
      date_from: filters.date_from === undefined ? '' : toDateText(filters.date_from),
      date_to: toDateText(anchorDate ?? today),
    },
  });
  const [dateFrom, dateTo] = useWatch({ control, name: ['date_from', 'date_to'] });

  function applyPeriod(values: PeriodFilterFormOutput) {
    const change = readPeriodChange({ values, today });
    onApply(change.filters, change.jumpDate);
  }
  const { schedule: applyDates, cancel } = useDebouncedAction(() => {
    void handleSubmit(applyPeriod)();
  });
  useImperativeHandle(ref, () => ({
    readPendingChange() {
      if (!cancel()) {
        return undefined;
      }
      const period = createPeriodFilterFormSchema(today).safeParse(getValues());
      const change = period.success ? readPeriodChange({ values: period.data, today }) : undefined;
      return change;
    },
  }));

  return (
    <form
      className={styles['periodFilter']}
      noValidate
      onChange={applyDates}
      onSubmit={(event) => {
        void handleSubmit(applyPeriod)(event);
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
            setValue('date_from', dateText);
            applyDates();
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
            setValue('date_to', dateText);
            applyDates();
          }}
        />
      </div>
    </form>
  );
}
