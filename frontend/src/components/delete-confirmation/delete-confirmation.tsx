import { useEffect, useId } from 'react';

import styles from './delete-confirmation.module.css';

type DeleteConfirmationProps = Readonly<{
  title: string;
  text: string;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}>;

export function DeleteConfirmation({
  title,
  text,
  isPending,
  onCancel,
  onConfirm,
}: DeleteConfirmationProps) {
  const titleId = useId();
  const textId = useId();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        if (!isPending) {
          onCancel();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown, { capture: true });

    return () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [isPending, onCancel]);

  return (
    <>
      <div className={styles['backdrop']} aria-hidden="true" />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={textId}
        aria-busy={isPending}
        className={styles['deleteConfirmation']}
      >
        <h2 id={titleId} className={styles['title']}>
          {title}
        </h2>
        <p id={textId} className={styles['text']}>
          {text}
        </p>
        <div className={styles['actions']}>
          <button
            ref={(cancelButton) => {
              cancelButton?.focus();
            }}
            type="button"
            className={styles['cancel']}
            disabled={isPending}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles['confirm']}
            disabled={isPending}
            onClick={onConfirm}
          >
            Delete
          </button>
        </div>
      </div>
    </>
  );
}
