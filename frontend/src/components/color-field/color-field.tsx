import { useId } from 'react';

import { ACCOUNT_COLORS, type AccountColor } from '@/lib/account-colors';

import styles from './color-field.module.css';

type ColorFieldProps = Readonly<{
  value: string | undefined;
  freeColors: readonly AccountColor[] | undefined;
  usedBy: string;
  onChange: (color: string) => void;
}>;

export function ColorField({ value, freeColors, usedBy, onChange }: ColorFieldProps) {
  const groupName = useId();
  const noteId = useId();
  const isEveryColorUsed = freeColors?.length === 0;
  const note =
    freeColors === undefined
      ? undefined
      : isEveryColorUsed
        ? `Every color is used by other ${usedBy}, so a new one can't be created yet.`
        : `Dimmed colors are used by other ${usedBy}.`;

  return (
    <fieldset
      className={styles['colorField']}
      aria-describedby={note === undefined ? undefined : noteId}
    >
      <legend className={styles['legend']}>Color</legend>
      <div className={styles['options']}>
        {ACCOUNT_COLORS.map((color) => (
          <label key={color.value} className={styles['option']}>
            <input
              type="radio"
              className="visually-hidden"
              name={groupName}
              value={color.value}
              checked={color.value === value}
              disabled={freeColors?.includes(color) === false}
              onChange={() => {
                onChange(color.value);
              }}
            />
            <span
              className={styles['swatch']}
              style={{ backgroundColor: color.value }}
              aria-hidden="true"
            />
            <span className="visually-hidden">{color.name}</span>
          </label>
        ))}
      </div>
      {note !== undefined && (
        <p id={noteId} className={isEveryColorUsed ? styles['blockingNote'] : styles['note']}>
          {note}
        </p>
      )}
    </fieldset>
  );
}
