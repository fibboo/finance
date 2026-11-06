import { useId } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';

import styles from './segmented-field.module.css';

type SegmentedFieldOption = Readonly<{ key: string; label: string }>;

type SegmentedFieldProps = Readonly<{
  legend: string;
  registration: UseFormRegisterReturn;
  options: readonly SegmentedFieldOption[];
  hint: string;
}>;

export function SegmentedField({ legend, registration, options, hint }: SegmentedFieldProps) {
  const hintId = useId();
  return (
    <fieldset className={styles['segmentedField']} aria-describedby={hintId}>
      <legend className={styles['legend']}>{legend}</legend>
      <div className={styles['track']}>
        {options.map((option) => (
          <label key={option.key} className={styles['option']}>
            <input {...registration} type="radio" className={styles['input']} value={option.key} />
            {option.label}
          </label>
        ))}
      </div>
      <p id={hintId} className={styles['hint']}>
        {hint}
      </p>
    </fieldset>
  );
}
