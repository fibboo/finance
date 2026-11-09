import { type ReactNode, useEffect, useId, useRef } from 'react';

import { LoadError } from '@/components/load-error/load-error';
import { Skeleton } from '@/components/skeleton/skeleton';
import { useSheetDrag } from '@/hooks/use-sheet-drag';

import styles from './details-panel.module.css';

const CLOSE_ICON_PATH = 'M6 6l12 12M18 6 6 18';
const DETAILS_PANEL_SELECTOR = '[data-details-panel]';
const DIALOG_SELECTOR = 'dialog, [role="dialog"]';

function readIsShown(bounds: DOMRectReadOnly): boolean {
  const isShown = bounds.height > 0;
  return isShown;
}

function readIsLatestShownPanel(panelId: string): boolean {
  const shownPanels = [...document.querySelectorAll<HTMLElement>(DETAILS_PANEL_SELECTOR)].filter(
    (panel) => readIsShown(panel.getBoundingClientRect()),
  );
  const latestShownPanel = shownPanels.reduce<HTMLElement | undefined>(
    (latest, panel) =>
      latest === undefined ||
      Number(panel.dataset['shownAt'] ?? 0) > Number(latest.dataset['shownAt'] ?? 0)
        ? panel
        : latest,
    undefined,
  );
  const isLatestShownPanel = latestShownPanel?.id === panelId;
  return isLatestShownPanel;
}

type DetailsPanelProps = Readonly<{
  label: string;
  isLoaded: boolean;
  isError: boolean;
  isFetching: boolean;
  errorMessage: string;
  returnFocusId: string;
  onRetry: () => void;
  onClose: () => void;
  renderContent: (closeButton: ReactNode) => ReactNode;
}>;

export function DetailsPanel({
  label,
  isLoaded,
  isError,
  isFetching,
  errorMessage,
  returnFocusId,
  onRetry,
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
      if (event.key !== 'Escape') {
        return;
      }

      const { target } = event;
      const dialog = target instanceof Element ? target.closest(DIALOG_SELECTOR) : null;
      const isForThisPanel =
        dialog === null ? readIsLatestShownPanel(panelId) : dialog.id === panelId;
      if (isForThisPanel) {
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

  useEffect(() => {
    const panel = document.getElementById(panelId);
    if (panel === null) {
      return undefined;
    }

    let isShown = readIsShown(panel.getBoundingClientRect());
    if (isShown) {
      panel.dataset['shownAt'] = String(performance.now());
    }

    const observer = new IntersectionObserver(([entry]) => {
      const isNowShown = entry !== undefined && readIsShown(entry.boundingClientRect);
      if (isNowShown && !isShown) {
        panel.dataset['shownAt'] = String(performance.now());
        const isFocusInDialog = (document.activeElement?.closest(DIALOG_SELECTOR) ?? null) !== null;
        const isSheet = getComputedStyle(panel).position === 'fixed';
        if (isSheet && !isFocusInDialog) {
          panel.focus({ preventScroll: true });
        }
      }

      isShown = isNowShown;
    });
    observer.observe(panel);

    return () => {
      observer.disconnect();
    };
  }, [panelId]);

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
        data-details-panel
        aria-busy={!isLoaded && isFetching}
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
        {isLoaded ? (
          renderContent(closeButton)
        ) : (
          <div className={styles['placeholder']}>
            {isError && !isFetching ? (
              <LoadError message={errorMessage} onRetry={onRetry} />
            ) : (
              <div className={styles['skeleton']}>
                <Skeleton className={styles['metaSkeleton']} />
                <Skeleton className={styles['titleSkeleton']} />
                <Skeleton className={styles['amountSkeleton']} />
              </div>
            )}
            {closeButton}
          </div>
        )}
      </section>
    </>
  );
}
