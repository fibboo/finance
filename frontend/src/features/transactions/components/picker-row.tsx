import { useId } from 'react';

import styles from './picker-row.module.css';

const CHEVRON_ICON_PATH = 'm9 6 6 6-6 6';

type PickerRowProps = Readonly<{
  id: string;
  label: string;
  value: string | undefined;
  placeholder: string;
  color: string | undefined;
  note: string | undefined;
  error: string | undefined;
  onOpen: (() => void) | undefined;
}>;

export function PickerRow({
  id,
  label,
  value,
  placeholder,
  color,
  note,
  error,
  onOpen,
}: PickerRowProps) {
  const errorId = useId();
  const content = (
    <>
      <span className={styles['label']}>{label}</span>
      {color !== undefined && (
        <span className={styles['dot']} style={{ backgroundColor: color }} aria-hidden="true" />
      )}
      <span className={value === undefined ? styles['placeholder'] : styles['value']}>
        {value ?? placeholder}
      </span>
      {note !== undefined && <span className={styles['note']}>{note}</span>}
    </>
  );
  return (
    <div className={styles['pickerRow']}>
      {onOpen === undefined ? (
        <div id={id} className={[styles['button'], styles['fixed']].join(' ')}>
          {content}
        </div>
      ) : (
        <button
          id={id}
          type="button"
          className={styles['button']}
          aria-describedby={error === undefined ? undefined : errorId}
          onClick={onOpen}
        >
          {content}
          <svg className={styles['chevron']} aria-hidden="true" viewBox="0 0 24 24">
            <path d={CHEVRON_ICON_PATH} />
          </svg>
        </button>
      )}
      {error !== undefined && (
        <span id={errorId} className={styles['error']}>
          {error}
        </span>
      )}
    </div>
  );
}
