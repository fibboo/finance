import { type ReactNode, useLayoutEffect, useRef } from 'react';

import { useSheetDrag } from '@/hooks/use-sheet-drag';

import styles from './sheet.module.css';

type SheetProps = Readonly<{
  label: string;
  onClose: () => void;
  children: ReactNode;
}>;

export function Sheet({ label, onClose, children }: SheetProps) {
  const sheetRef = useRef<HTMLDialogElement>(null);
  const handleRef = useRef<HTMLSpanElement>(null);
  const isUnmountingRef = useRef(false);
  const dragHandlers = useSheetDrag({ handleRef, onClose });

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
          return;
        }

        dragHandlers.onPointerDown(event);
      }}
      onPointerMove={dragHandlers.onPointerMove}
      onPointerUp={dragHandlers.onPointerUp}
      onPointerCancel={dragHandlers.onPointerCancel}
    >
      <div className={styles['content']}>
        <span
          ref={handleRef}
          className={styles['handle']}
          aria-hidden="true"
          data-sheet-drag-area
        />
        {children}
      </div>
    </dialog>
  );
}
