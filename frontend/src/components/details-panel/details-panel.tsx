import { type ReactNode, useEffect, useEffectEvent, useId, useRef } from 'react';
import { Link, NavigationType, type To, useLocation, useNavigationType } from 'react-router';
import { z } from 'zod';

import { LoadError } from '@/components/load-error/load-error';
import { Skeleton } from '@/components/skeleton/skeleton';
import {
  type ArrowKeySelectionProps,
  readIsArrowKeySelection,
} from '@/hooks/use-arrow-key-selection';
import { useSheetDrag } from '@/hooks/use-sheet-drag';

import styles from './details-panel.module.css';
import { focusReturnTarget } from './focus-return';

const CLOSE_ICON_PATH = 'M6 6l12 12M18 6 6 18';
const BACK_ICON_PATH = 'm15 6-6 6 6 6';
const DETAILS_PANEL_SELECTOR = '[data-details-panel]';
const DIALOG_SELECTOR = 'dialog, [role="dialog"]';

const inPlaceStateSchema = z.object({ isInPlace: z.literal(true) });

const IN_PLACE_STATE = { isInPlace: true } satisfies z.infer<typeof inPlaceStateSchema>;

export type DetailsBack = Readonly<{ to: To; label: string; returnFocusId: string }>;

function readIsShown(bounds: DOMRectReadOnly): boolean {
  const isShown = bounds.height > 0;
  return isShown;
}

function readIsSheet(backdropId: string): boolean {
  const backdrop = document.getElementById(backdropId);
  const isSheet = backdrop !== null && readIsShown(backdrop.getBoundingClientRect());
  return isSheet;
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
  isInPlace,
}: Readonly<{
  isShownByDefault: boolean;
  isKeptOpenOnDesktop: boolean;
  isInPlace: boolean;
}>): string {
  const panelClassName = [
    styles['detailsPanel'],
    isShownByDefault ? styles['shownByDefault'] : undefined,
    isKeptOpenOnDesktop ? styles['keptOpenOnDesktop'] : undefined,
    isInPlace ? styles['inPlace'] : undefined,
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
  isReplacing: boolean;
  isShownByDefault: boolean;
  isKeptOpenOnDesktop: boolean;
  errorMessage: string;
  returnFocusId: string;
  arrowKeyList: ArrowKeySelectionProps | undefined;
  back: DetailsBack | undefined;
  onRetry: () => void;
  onClose: () => void;
  onChoose: () => void;
  renderContent: (closeButton: ReactNode) => ReactNode;
  renderSkeleton: ((closeButton: ReactNode) => ReactNode) | undefined;
}>;

export function DetailsPanel({
  label,
  isLoaded,
  isError,
  isFetching,
  isReplacing,
  isShownByDefault,
  isKeptOpenOnDesktop,
  errorMessage,
  returnFocusId: panelReturnFocusId,
  arrowKeyList,
  back,
  onRetry,
  onClose,
  onChoose,
  renderContent,
  renderSkeleton,
}: DetailsPanelProps) {
  const returnFocusId = back?.returnFocusId ?? panelReturnFocusId;
  const backdropId = useId();
  const panelId = useId();
  const location = useLocation();
  const isArrowKeySelection =
    useNavigationType() !== NavigationType.Pop && readIsArrowKeySelection(location.state);
  const isInPlace = back !== undefined || inPlaceStateSchema.safeParse(location.state).success;
  const handleRef = useRef<HTMLSpanElement>(null);

  function close() {
    onClose();
    focusReturnTarget(returnFocusId);
  }

  const dragHandlers = useSheetDrag({ handleRef, onClose: close });

  useEffect(() => {
    if (isShownByDefault) {
      return undefined;
    }

    function closePanel() {
      onClose();
      focusReturnTarget(returnFocusId);
    }

    function handleClick(event: MouseEvent) {
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

    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isShownByDefault, onClose, returnFocusId, backdropId, panelId]);

  const readIsFocusKeptOnRow = useEffectEvent(() => {
    const isFocusKeptOnRow = isArrowKeySelection && !readIsSheet(backdropId);
    return isFocusKeptOnRow;
  });

  useEffect(() => {
    const panel = document.getElementById(panelId);
    const isFocusInDialog = (document.activeElement?.closest(DIALOG_SELECTOR) ?? null) !== null;
    if (panel !== null && !isShownByDefault && !isFocusInDialog && !readIsFocusKeptOnRow()) {
      panel.focus({ preventScroll: true });
      panel.scrollIntoView({ block: 'nearest' });
    }
  }, [panelId, returnFocusId, isShownByDefault]);

  useEffect(() => {
    const panel = document.getElementById(panelId);
    if (panel === null || isShownByDefault) {
      return undefined;
    }

    let isShown = readIsShown(panel.getBoundingClientRect());
    const observer = new IntersectionObserver(([entry]) => {
      const isNowShown = entry !== undefined && readIsShown(entry.boundingClientRect);
      const isSheet = readIsSheet(backdropId);
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

  const closeButton = back === undefined && (
    <button type="button" className={styles['close']} aria-label="Close details" onClick={close}>
      <svg className={styles['closeIcon']} aria-hidden="true" viewBox="0 0 24 24">
        <path d={CLOSE_ICON_PATH} />
      </svg>
    </button>
  );
  const isFailed = isError && !isFetching;
  const isSkeletonShown = renderSkeleton !== undefined && (isReplacing || (!isLoaded && !isFailed));
  return (
    <>
      {!isShownByDefault && (
        <div
          id={backdropId}
          className={`${styles['backdrop'] ?? ''} ${isInPlace ? (styles['inPlace'] ?? '') : ''}`}
          data-testid="details-panel-backdrop"
          aria-hidden="true"
        />
      )}
      <section
        id={panelId}
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
        data-return-focus-id={returnFocusId}
        {...arrowKeyList}
        data-details
        aria-busy={isSkeletonShown || (!isLoaded && isFetching) || isReplacing}
        tabIndex={-1}
        className={readPanelClassName({ isShownByDefault, isKeptOpenOnDesktop, isInPlace })}
        {...dragHandlers}
      >
        <span
          ref={handleRef}
          className={styles['handle']}
          aria-hidden="true"
          data-sheet-drag-area
        />
        {back !== undefined && (
          <Link to={back.to} state={IN_PLACE_STATE} preventScrollReset className={styles['back']}>
            <svg className={styles['backIcon']} aria-hidden="true" viewBox="0 0 24 24">
              <path d={BACK_ICON_PATH} />
            </svg>
            {back.label}
          </Link>
        )}
        {isSkeletonShown ? (
          <div className={styles['content']}>{renderSkeleton(closeButton)}</div>
        ) : isLoaded ? (
          <div className={styles['content']} inert={isReplacing}>
            {renderContent(closeButton)}
            {isReplacing && (
              <div className={styles['replacingSkeleton']}>
                <Skeleton className={styles['metaSkeleton']} />
                <Skeleton className={styles['titleSkeleton']} />
                <Skeleton className={styles['amountSkeleton']} />
                <Skeleton className={styles['bodySkeleton']} />
              </div>
            )}
          </div>
        ) : (
          <div className={styles['placeholder']}>
            {isFailed ? (
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
