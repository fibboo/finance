import { useId } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';

import { USERNAME_RULE } from '../schemas/username-form';
import styles from './username-field.module.css';

type UsernameFieldProps = Readonly<{
  registration: UseFormRegisterReturn<'username'>;
  error: string | undefined;
}>;

export function UsernameField({ registration, error }: UsernameFieldProps) {
  const inputId = useId();
  const messageId = useId();

  return (
    <div className={styles['usernameField']}>
      <label htmlFor={inputId} className={styles['label']}>
        Username
      </label>
      <div className={styles['control']}>
        <span className={styles['prefix']} aria-hidden="true">
          @
        </span>
        <input
          id={inputId}
          className={styles['input']}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={error !== undefined}
          aria-describedby={messageId}
          {...registration}
        />
      </div>
      {error === undefined ? (
        <p id={messageId} className={styles['hint']}>
          {USERNAME_RULE}
        </p>
      ) : (
        <p id={messageId} className={styles['error']} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
