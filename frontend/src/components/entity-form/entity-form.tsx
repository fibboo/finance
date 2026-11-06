import type { SubmitEventHandler, ReactNode } from 'react';

import styles from './entity-form.module.css';

const BACK_ICON_PATH = 'm15 6-6 6 6 6';

type EntityFormProps = Readonly<{
  title: string;
  submitLabel: string;
  isSubmitDisabled: boolean;
  error: string | undefined;
  onBack: () => void;
  onSubmit: SubmitEventHandler<HTMLFormElement>;
  children: ReactNode;
}>;

export function EntityForm({
  title,
  submitLabel,
  isSubmitDisabled,
  error,
  onBack,
  onSubmit,
  children,
}: EntityFormProps) {
  return (
    <form
      ref={(form) => {
        const nameInput = form?.elements.namedItem('name');
        if (nameInput instanceof HTMLInputElement) {
          nameInput.focus({ preventScroll: true });
        }
      }}
      className={styles['entityForm']}
      aria-label={title}
      noValidate
      onSubmit={onSubmit}
    >
      <div className={styles['header']}>
        <button type="button" className={styles['back']} aria-label="Back" onClick={onBack}>
          <svg className={styles['icon']} aria-hidden="true" viewBox="0 0 24 24">
            <path d={BACK_ICON_PATH} />
          </svg>
        </button>
        <h2 className={styles['title']}>{title}</h2>
      </div>
      {children}
      {error !== undefined && (
        <p className={styles['error']} role="alert">
          {error}
        </p>
      )}
      <button type="submit" className={styles['submit']} disabled={isSubmitDisabled}>
        {submitLabel}
      </button>
    </form>
  );
}
