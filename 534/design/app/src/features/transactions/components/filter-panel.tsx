import { type ReactNode, useEffect, useEffectEvent, useId, useRef } from 'react';

import { useOutsideClick } from '@/hooks/use-outside-click';
import { useSheetDrag } from '@/hooks/use-sheet-drag';

import styles from './filter-panel.module.css';
import panelStyles from './filters-panel.module.css';

type FilterPanelProps = Readonly<{
  count: number;
  isOpen: boolean;
  isDisabled?: boolean;
  onBeforeClose?: () => void;
  onOpenChange: (isOpen: boolean) => void;
  children: (close: () => void) => ReactNode;
}>;

function focusPanel(panel: HTMLDivElement | null) {
  panel?.focus();
}

export function FilterPanel({
  count,
  isOpen,
  isDisabled = false,
  onBeforeClose,
  onOpenChange,
  children,
}: FilterPanelProps) {
  const buttonId = useId();
  const panelId = useId();
  const handleRef = useRef<HTMLSpanElement>(null);
  function close() {
    onBeforeClose?.();
    onOpenChange(false);
    document.getElementById(buttonId)?.focus();
  }
  const dragHandlers = useSheetDrag({ handleRef, onClose: close });
  const closeOnEscape = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === 'Escape' && document.querySelector('dialog[open]') === null) {
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
    }
  });
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    document.addEventListener('keydown', closeOnEscape, true);
    return () => {
      document.removeEventListener('keydown', closeOnEscape, true);
    };
  }, [isOpen]);
  useOutsideClick({
    isActive: isOpen,
    readIsInside: (target) =>
      (target instanceof Element && target.closest('dialog[open]') !== null) ||
      [buttonId, panelId].some((id) => document.getElementById(id)?.contains(target) === true),
    onOutsideClick: close,
  });
  return (
    <div className={styles['filterPanel']}>
      <button
        id={buttonId}
        type="button"
        className={count > 0 ? styles['activeButton'] : styles['button']}
        aria-label="Filters"
        aria-expanded={isOpen}
        aria-controls={panelId}
        disabled={isDisabled}
        onClick={() => {
          if (isOpen) {
            close();
          } else {
            onOpenChange(true);
          }
        }}
      >
        <svg className={styles['icon']} aria-hidden="true" viewBox="0 0 24 24">
          <path d="M4 6h16M7 12h10M10 18h4" />
        </svg>
        <span className={styles['label']}>Filters</span>
        {count > 0 && <span className={styles['badge']}>{count}</span>}
      </button>
      {isOpen && (
        <>
          <div className={panelStyles['backdrop']} aria-hidden="true" />
          <div
            id={panelId}
            ref={focusPanel}
            role="dialog"
            aria-label="Filters"
            tabIndex={-1}
            className={panelStyles['panel']}
            {...dragHandlers}
          >
            <span
              ref={handleRef}
              className={panelStyles['handle']}
              aria-hidden="true"
              data-sheet-drag-area
            />
            {children(close)}
          </div>
        </>
      )}
    </div>
  );
}
