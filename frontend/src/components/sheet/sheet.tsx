import { type ReactNode, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';

import styles from './sheet.module.css';

type SheetProps = Readonly<{
  label: string;
  onClose: () => void;
  children: ReactNode;
}>;

export function Sheet({ label, onClose, children }: SheetProps) {
  const backdropId = useId();
  const sheetId = useId();

  useEffect(() => {
    const sheetLayer = document.getElementById(sheetId)?.parentElement;
    const background = [...document.body.children].filter(
      (element) => element !== sheetLayer && element instanceof HTMLElement && !element.inert,
    );
    background.forEach((element) => {
      if (element instanceof HTMLElement) {
        element.inert = true;
      }
    });

    return () => {
      background.forEach((element) => {
        if (element instanceof HTMLElement) {
          element.inert = false;
        }
      });
    };
  }, [sheetId]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (event.target === document.getElementById(backdropId)) {
        onClose();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, backdropId]);

  const sheet = (
    <div>
      <div id={backdropId} className={styles['backdrop']} aria-hidden="true" />
      <section
        id={sheetId}
        ref={(panel) => {
          const opener = document.activeElement;
          panel?.focus({ preventScroll: true });
          return () => {
            if (opener instanceof HTMLElement) {
              opener.focus({ preventScroll: true });
            }
          };
        }}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={styles['sheet']}
      >
        <span className={styles['handle']} aria-hidden="true" />
        {children}
      </section>
    </div>
  );
  return createPortal(sheet, document.body);
}
