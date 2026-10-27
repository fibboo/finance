import { useRef } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';

import { maskDateText, readIsoDate, toDateText } from '../schemas/transaction-filter-forms';
import styles from './date-field.module.css';
import { FilterField } from './filter-field';

const CALENDAR_ICON_PATH =
  'M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z';
const DATE_TEXT_PLACEHOLDER = 'mm/dd/yyyy';

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
  const pickerRef = useRef<HTMLInputElement>(null);
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
        <span className={styles['calendar']}>
          <input
            ref={pickerRef}
            type="date"
            className={styles['picker']}
            max={max}
            tabIndex={-1}
            aria-hidden="true"
            disabled={isDisabled}
            onChange={(event) => {
              if (event.target.value !== '') {
                onPick(toDateText(event.target.value));
              }
            }}
          />
          <button
            type="button"
            className={styles['calendarButton']}
            aria-label={`Pick the ${label} date from a calendar`}
            disabled={isDisabled}
            onClick={() => {
              const picker = pickerRef.current;
              if (picker !== null) {
                picker.value = readIsoDate(value) ?? '';
                picker.showPicker();
              }
            }}
          >
            <svg className={styles['icon']} aria-hidden="true" viewBox="0 0 24 24">
              <path d={CALENDAR_ICON_PATH} />
            </svg>
          </button>
        </span>
      }
    />
  );
}
