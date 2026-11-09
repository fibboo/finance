import { useId } from 'react';

import styles from './delete-button.module.css';

const DELETE_ICON_PATH =
  'M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3';

type DeleteButtonProps = Readonly<{
  id: string;
  label: string;
  blockingHint: string | undefined;
  onClick: () => void;
}>;

export function DeleteButton({ id, label, blockingHint, onClick }: DeleteButtonProps) {
  const hintId = useId();
  const isBlocked = blockingHint !== undefined;
  return (
    <div className={styles['deleteButton']}>
      <button
        id={id}
        type="button"
        className={styles['button']}
        aria-disabled={isBlocked}
        aria-describedby={isBlocked ? hintId : undefined}
        onClick={() => {
          if (!isBlocked) {
            onClick();
          }
        }}
      >
        <svg className={styles['icon']} aria-hidden="true" viewBox="0 0 24 24">
          <path d={DELETE_ICON_PATH} />
        </svg>
        {label}
      </button>
      {isBlocked && (
        <span id={hintId} className={styles['hint']}>
          {blockingHint}
        </span>
      )}
    </div>
  );
}
