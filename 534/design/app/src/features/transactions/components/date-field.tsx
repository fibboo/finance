import type { UseFormRegisterReturn } from 'react-hook-form';

import { CalendarButton } from './calendar-button';
import { readDateInputProps } from './date-input';
import { FilterField } from './filter-field';
import styles from './date-field.module.css';

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
      input={{ ...readDateInputProps(registration), value }}
      action={
        value !== '' ? (
          <button
            type="button"
            className={styles['clear']}
            aria-label={`Clear ${label}`}
            disabled={isDisabled}
            onClick={() => {
              onPick('');
            }}
          >
            ×
          </button>
        ) : (
          <CalendarButton
            label={label}
            value={value}
            isDisabled={isDisabled}
            max={max}
            onPick={onPick}
          />
        )
      }
    />
  );
}
