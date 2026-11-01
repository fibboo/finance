import { type ReactNode, useEffect, useId } from 'react';

import styles from './sheet.module.css';

type SheetProps = Readonly<{
  label: string;
  onClose: () => void;
  children: ReactNode;
}>;

export function Sheet({ label, onClose, children }: SheetProps) {
  const sheetId = useId();

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (event.target === document.getElementById(sheetId)) {
        onClose();
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [onClose, sheetId]);

  return (
    <dialog
      id={sheetId}
      ref={(sheet) => {
        const opener = document.activeElement;
        if (sheet !== null && !sheet.open) {
          sheet.showModal();
        }

        return () => {
          sheet?.close();
          if (opener instanceof HTMLElement) {
            opener.focus({ preventScroll: true });
          }
        };
      }}
      aria-label={label}
      className={styles['sheet']}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className={styles['content']}>
        <span className={styles['handle']} aria-hidden="true" />
        {children}
      </div>
    </dialog>
  );
}
