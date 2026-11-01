import { useRef } from 'react';

import { readIsoDate, toDateText } from '@/lib/format-date';

import styles from './calendar-button.module.css';

const CALENDAR_ICON_PATH =
  'M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z';

type CalendarButtonProps = Readonly<{
  label: string;
  value: string;
  isDisabled?: boolean;
  max: string;
  onPick: (dateText: string) => void;
}>;

export function CalendarButton({
  label,
  value,
  isDisabled = false,
  max,
  onPick,
}: CalendarButtonProps) {
  const pickerRef = useRef<HTMLInputElement>(null);
  return (
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
  );
}
