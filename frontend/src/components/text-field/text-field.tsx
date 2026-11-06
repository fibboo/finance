import { useId } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';

import styles from './text-field.module.css';

const MULTILINE_ROWS = 3;

type TextFieldProps = Readonly<{
  label: string;
  registration: UseFormRegisterReturn;
  placeholder: string | undefined;
  maxLength: number;
  isOptional: boolean;
  isMultiline: boolean;
  error: string | undefined;
}>;

export function TextField({
  label,
  registration,
  placeholder,
  maxLength,
  isOptional,
  isMultiline,
  error,
}: TextFieldProps) {
  const inputId = useId();
  const errorId = useId();
  const controlProps = {
    ...registration,
    id: inputId,
    className: styles['control'],
    placeholder,
    maxLength,
    autoComplete: 'off',
    'aria-invalid': error !== undefined,
    'aria-describedby': error === undefined ? undefined : errorId,
  };

  return (
    <div className={styles['textField']}>
      <label htmlFor={inputId} className={styles['label']}>
        {label}
        {isOptional && <span className={styles['optional']}> (optional)</span>}
      </label>
      {isMultiline ? (
        <textarea {...controlProps} rows={MULTILINE_ROWS} />
      ) : (
        <input {...controlProps} />
      )}
      {error !== undefined && (
        <p id={errorId} className={styles['error']} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
