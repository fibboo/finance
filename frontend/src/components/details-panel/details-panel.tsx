import { type ReactNode, useEffect, useId, useRef } from 'react';

import { useSheetDrag } from '@/hooks/use-sheet-drag';

import styles from './details-panel.module.css';

const CLOSE_ICON_PATH = 'M6 6l12 12M18 6 6 18';

type DetailsPanelProps = Readonly<{
  label: string;
  isBusy: boolean;
  returnFocusId: string;
  onClose: () => void;
  renderContent: (closeButton: ReactNode) => ReactNode;
}>;

export function DetailsPanel({
  label,
  isBusy,
  returnFocusId,
  onClose,
  renderContent,
}: DetailsPanelProps) {
  const backdropId = useId();
  const panelId = useId();
  const handleRef = useRef<HTMLSpanElement>(null);

  function close() {
    onClose();
    document.getElementById(returnFocusId)?.focus();
  }

  const dragHandlers = useSheetDrag({ handleRef, onClose: close });

  useEffect(() => {
    function closePanel() {
      onClose();
      document.getElementById(returnFocusId)?.focus();
    }

    function handlePointerDown(event: PointerEvent) {
      if (event.target === document.getElementById(backdropId)) {
        closePanel();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      const { target } = event;
      const dialog = target instanceof Element ? target.closest('[role="dialog"]') : null;
      const isInOtherDialog = dialog !== null && dialog.id !== panelId;
      if (event.key === 'Escape' && !isInOtherDialog) {
        closePanel();
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, returnFocusId, backdropId, panelId]);

  const closeButton = (
    <button type="button" className={styles['close']} aria-label="Close details" onClick={close}>
      <svg className={styles['closeIcon']} aria-hidden="true" viewBox="0 0 24 24">
        <path d={CLOSE_ICON_PATH} />
      </svg>
    </button>
  );
  return (
    <>
      <div id={backdropId} className={styles['backdrop']} aria-hidden="true" />
      <section
        id={panelId}
        ref={(panel) => {
          panel?.focus({ preventScroll: true });
          panel?.scrollIntoView({ block: 'nearest' });
        }}
        role="dialog"
        aria-label={label}
        aria-busy={isBusy}
        tabIndex={-1}
        className={styles['detailsPanel']}
        {...dragHandlers}
      >
        <span
          ref={handleRef}
          className={styles['handle']}
          aria-hidden="true"
          data-sheet-drag-area
        />
        {renderContent(closeButton)}
      </section>
    </>
  );
}
