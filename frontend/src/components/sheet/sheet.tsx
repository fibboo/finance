import { type ReactNode, useEffect, useId } from 'react';

import styles from './sheet.module.css';

type SheetProps = Readonly<{
  label: string;
  onClose: () => void;
  children: ReactNode;
}>;

export function Sheet({ label, onClose, children }: SheetProps) {
  const backdropId = useId();

  useEffect(() => {
    const opener = document.activeElement;
    return () => {
      if (opener instanceof HTMLElement) {
        opener.focus();
      }
    };
  }, []);

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

  return (
    <>
      <div id={backdropId} className={styles['backdrop']} aria-hidden="true" />
      <section
        ref={(panel) => {
          panel?.focus({ preventScroll: true });
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
    </>
  );
}
