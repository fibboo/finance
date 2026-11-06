import { type ReactNode, useEffect, useId, useRef, useState } from 'react';

import { useSheetDrag } from '@/hooks/use-sheet-drag';

import styles from './filter-panel.module.css';

const CLOSE_ICON_PATH = 'M6 6l12 12M18 6 6 18';
const CHEVRON_ICON_PATH = 'm6 9 6 6 6-6';

type FilterPanelProps = Readonly<{
  title: string;
  chipLabel: string;
  isActive: boolean;
  children: (close: () => void) => ReactNode;
}>;

export function FilterPanel({ title, chipLabel, isActive, children }: FilterPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const chipId = useId();
  const panelId = useId();
  const titleId = useId();
  const handleRef = useRef<HTMLSpanElement>(null);

  function close() {
    setIsOpen(false);
    document.getElementById(chipId)?.focus();
  }

  const dragHandlers = useSheetDrag({ handleRef, onClose: close });

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const { target } = event;
      const isOutside =
        target instanceof Node &&
        [chipId, panelId].every((id) => document.getElementById(id)?.contains(target) !== true);

      if (isOutside) {
        setIsOpen(false);
        document.getElementById(chipId)?.focus();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        document.getElementById(chipId)?.focus();
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, chipId, panelId]);

  return (
    <div className={styles['filterPanel']}>
      <button
        id={chipId}
        type="button"
        className={isActive ? styles['activeChip'] : styles['chip']}
        aria-label={chipLabel === title ? undefined : `${title}: ${chipLabel}`}
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => {
          setIsOpen(!isOpen);
        }}
      >
        {chipLabel}
        <svg className={styles['chevron']} aria-hidden="true" viewBox="0 0 24 24">
          <path d={CHEVRON_ICON_PATH} />
        </svg>
      </button>
      {isOpen && (
        <>
          <div className={styles['backdrop']} aria-hidden="true" />
          <div
            id={panelId}
            ref={(panel) => {
              panel?.focus();
            }}
            role="dialog"
            aria-labelledby={titleId}
            tabIndex={-1}
            className={styles['panel']}
            {...dragHandlers}
          >
            <span
              ref={handleRef}
              className={styles['handle']}
              aria-hidden="true"
              data-sheet-drag-area
            />
            <div className={styles['header']} data-sheet-drag-area>
              <h2 id={titleId} className={styles['title']}>
                {title}
              </h2>
              <button type="button" className={styles['close']} aria-label="Close" onClick={close}>
                <svg className={styles['closeIcon']} aria-hidden="true" viewBox="0 0 24 24">
                  <path d={CLOSE_ICON_PATH} />
                </svg>
              </button>
            </div>
            {children(close)}
          </div>
        </>
      )}
    </div>
  );
}
