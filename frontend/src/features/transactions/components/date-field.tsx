import type { UseFormRegisterReturn } from 'react-hook-form';

import { DATE_TEXT_PLACEHOLDER, maskDateText } from '@/lib/format-date';

import { CalendarButton } from './calendar-button';
import { FilterField } from './filter-field';

type DateFieldProps = Readonly<{
  label: string;
  error: string | undefined;
  registration: UseFormRegisterReturn;
  value: string;
  isDisabled?: boolean;
  max: string;
  onPick: (dateText: string) => void;
}>;

export function DateField({
  label,
  error,
  registration,
  value,
  isDisabled = false,
  max,
  onPick,
}: DateFieldProps) {
  return (
    <FilterField
      label={label}
      error={error}
      input={{
        ...registration,
        type: 'text',
        inputMode: 'numeric',
        autoComplete: 'off',
        placeholder: DATE_TEXT_PLACEHOLDER,
        onChange: (event) => {
          event.target.value = maskDateText(event.target.value);
          void registration.onChange(event);
        },
      }}
      action={
        <CalendarButton
          label={label}
          value={value}
          isDisabled={isDisabled}
          max={max}
          onPick={onPick}
        />
      }
    />
  );
}
