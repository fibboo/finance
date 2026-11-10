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

function readIsOnlyShownPanel(panelId: string): boolean {
  const shownPanels = [...document.querySelectorAll(DETAILS_PANEL_SELECTOR)].filter((panel) =>
    readIsShown(panel.getBoundingClientRect()),
  );
  const isOnlyShownPanel = shownPanels.length === 1 && shownPanels[0]?.id === panelId;
  return isOnlyShownPanel;
}

function readPanelClassName({
  isShownByDefault,
  isKeptOpenOnDesktop,
}: Readonly<{ isShownByDefault: boolean; isKeptOpenOnDesktop: boolean }>): string {
  const panelClassName = [
    styles['detailsPanel'],
    isShownByDefault ? styles['shownByDefault'] : undefined,
    isKeptOpenOnDesktop ? styles['keptOpenOnDesktop'] : undefined,
  ]
    .filter((className) => className !== undefined)
    .join(' ');
  return panelClassName;
}

type DetailsPanelProps = Readonly<{
  label: string;
  isLoaded: boolean;
  isError: boolean;
  isFetching: boolean;
  isShownByDefault: boolean;
  isKeptOpenOnDesktop: boolean;
  errorMessage: string;
  returnFocusId: string;
  onRetry: () => void;
  onClose: () => void;
  onChoose: () => void;
  renderContent: (closeButton: ReactNode) => ReactNode;
}>;

export function DetailsPanel({
  label,
  isLoaded,
  isError,
  isFetching,
  isShownByDefault,
  isKeptOpenOnDesktop,
  errorMessage,
  returnFocusId,
  onRetry,
  onClose,
  onChoose,
  renderContent,
}: DetailsPanelProps) {
  const backdropId = useId();
  const panelId = useId();
  const handleRef = useRef<HTMLSpanElement>(null);
  const isMountedByDefaultRef = useRef(isShownByDefault);

  function close() {
    onClose();
    document.getElementById(returnFocusId)?.focus();
  }

  const dragHandlers = useSheetDrag({ handleRef, onClose: close });

  useEffect(() => {
    if (isShownByDefault) {
      return undefined;
    }

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
        dialog === null ? readIsOnlyShownPanel(panelId) : dialog.id === panelId;
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
  }, [isShownByDefault, onClose, returnFocusId, backdropId, panelId]);

  useEffect(() => {
    const panel = document.getElementById(panelId);
    if (panel === null || isShownByDefault) {
      return undefined;
    }

    let isShown = readIsShown(panel.getBoundingClientRect());
    const observer = new IntersectionObserver(([entry]) => {
      const isNowShown = entry !== undefined && readIsShown(entry.boundingClientRect);
      const backdrop = document.getElementById(backdropId);
      const isSheet = backdrop !== null && readIsShown(backdrop.getBoundingClientRect());
      const isFocusInDialog = (document.activeElement?.closest(DIALOG_SELECTOR) ?? null) !== null;
      if (isNowShown && !isShown && isSheet && !isFocusInDialog) {
        panel.focus({ preventScroll: true });
      }

      isShown = isNowShown;
    });
    observer.observe(panel);

    return () => {
      observer.disconnect();
    };
  }, [isShownByDefault, panelId, backdropId]);

  const closeButton = (
    <button type="button" className={styles['close']} aria-label="Close details" onClick={close}>
      <svg className={styles['closeIcon']} aria-hidden="true" viewBox="0 0 24 24">
        <path d={CLOSE_ICON_PATH} />
      </svg>
    </button>
  );
  return (
    <>
      {!isShownByDefault && (
        <div id={backdropId} className={styles['backdrop']} aria-hidden="true" />
      )}
      <section
        id={panelId}
        ref={(panel) => {
          if (!isMountedByDefaultRef.current) {
            panel?.focus({ preventScroll: true });
            panel?.scrollIntoView({ block: 'nearest' });
          }
        }}
        onFocusCapture={() => {
          if (isShownByDefault) {
            onChoose();
          }
        }}
        onPointerDownCapture={() => {
          if (isShownByDefault) {
            onChoose();
          }
        }}
        role="dialog"
        aria-label={label}
        data-details-panel={isShownByDefault ? undefined : true}
        aria-busy={!isLoaded && isFetching}
        tabIndex={-1}
        className={readPanelClassName({ isShownByDefault, isKeptOpenOnDesktop })}
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
