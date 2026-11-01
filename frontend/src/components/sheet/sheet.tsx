import { type ReactNode, useLayoutEffect, useRef } from 'react';

import styles from './sheet.module.css';

type SheetProps = Readonly<{
  label: string;
  onClose: () => void;
  children: ReactNode;
}>;

export function Sheet({ label, onClose, children }: SheetProps) {
  const sheetRef = useRef<HTMLDialogElement>(null);
  const isUnmountingRef = useRef(false);

  useLayoutEffect(() => {
    const sheet = sheetRef.current;
    if (sheet === null) {
      return undefined;
    }

    isUnmountingRef.current = false;
    sheet.showModal();
    sheet.focus({ preventScroll: true });

    return () => {
      isUnmountingRef.current = true;
      sheet.close();
    };
  }, []);

  return (
    <dialog
      ref={sheetRef}
      aria-label={label}
      tabIndex={-1}
      className={styles['sheet']}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={(event) => {
        if (!isUnmountingRef.current && !event.currentTarget.open) {
          onClose();
        }
      }}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className={styles['content']}>
        <span className={styles['handle']} aria-hidden="true" />
        {children}
      </div>
    </dialog>
  );
}
