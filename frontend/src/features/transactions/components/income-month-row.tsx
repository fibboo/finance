import { useFormContext, useWatch } from 'react-hook-form';

import { useToday } from '@/hooks/use-today';
import type { components } from '@/lib/api-schema';
import { readIsoDate } from '@/lib/format-date';

import { type MovementFormValues, readPreviousMonth } from '../schemas/transaction-form';
import { readIncomeMonths } from './income-months';
import { SelectRow } from './select-row';

type MovementRequest = components['schemas']['MovementRequest'];

export function IncomeMonthRow() {
  const today = useToday();
  const { control, setValue, formState } = useFormContext<
    MovementFormValues,
    unknown,
    MovementRequest
  >();
  const [incomePeriod, date] = useWatch({ control, name: ['income_period', 'transaction_date'] });
  const isoDate = readIsoDate(date) ?? today;
  const month = incomePeriod === '' ? readPreviousMonth(isoDate) : incomePeriod;
  return (
    <SelectRow
      label="For month"
      select={{
        name: 'income_period',
        value: month,
        onChange: (event) => {
          setValue('income_period', event.target.value, {
            shouldDirty: true,
            shouldValidate: formState.isSubmitted,
          });
        },
      }}
      options={readIncomeMonths({ isoDate, selectedMonth: month })}
      error={formState.errors.income_period?.message}
    />
  );
}
