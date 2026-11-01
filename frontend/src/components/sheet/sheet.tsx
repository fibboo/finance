import { type ReactNode, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';

import styles from './sheet.module.css';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not(:disabled)',
  'input:not(:disabled):not([tabindex="-1"])',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function readFocusableElements(sheet: HTMLElement): readonly HTMLElement[] {
  const focusableElements = [...sheet.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
    (element) => element.closest('[hidden]') === null,
  );
  return focusableElements;
}

type SheetProps = Readonly<{
  label: string;
  onClose: () => void;
  children: ReactNode;
}>;

export function Sheet({ label, onClose, children }: SheetProps) {
  const backdropId = useId();
  const sheetId = useId();

  useEffect(() => {
    const opener = document.activeElement;
    document.getElementById(sheetId)?.focus({ preventScroll: true });

    return () => {
      if (opener instanceof HTMLElement) {
        opener.focus({ preventScroll: true });
      }
    };
  }, [sheetId]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (event.target === document.getElementById(backdropId)) {
        onClose();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      const sheet = document.getElementById(sheetId);
      if (event.key === 'Escape') {
        onClose();
      } else if (event.key === 'Tab' && sheet !== null) {
        const focusableElements = readFocusableElements(sheet);
        const firstElement = focusableElements[0];
        const lastElement = focusableElements.at(-1);
        const activeElement = document.activeElement;
        const isLeavingBackward =
          event.shiftKey && (activeElement === firstElement || activeElement === sheet);
        const isLeavingForward = !event.shiftKey && activeElement === lastElement;
        if (!sheet.contains(activeElement) || isLeavingForward) {
          event.preventDefault();
          firstElement?.focus();
        } else if (isLeavingBackward) {
          event.preventDefault();
          lastElement?.focus();
        }
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, backdropId, sheetId]);

  const sheet = (
    <div>
      <div id={backdropId} className={styles['backdrop']} aria-hidden="true" />
      <section
        id={sheetId}
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
