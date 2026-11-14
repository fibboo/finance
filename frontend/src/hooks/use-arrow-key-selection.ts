import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';

type Orientation = 'vertical' | 'horizontal';

const STEP_KEYS = {
  vertical: { ArrowDown: 1, ArrowUp: -1 },
  horizontal: { ArrowRight: 1, ArrowLeft: -1 },
} satisfies Readonly<Record<Orientation, Readonly<Record<string, number>>>>;

const KEY_OWNER_SELECTOR =
  'input, textarea, select, [contenteditable="true"], dialog, [role="dialog"]:not([data-details-panel])';

const arrowKeySelectionStateSchema = z.object({ isArrowKeySelection: z.literal(true) });

const ARROW_KEY_SELECTION_STATE = { isArrowKeySelection: true } satisfies z.infer<
  typeof arrowKeySelectionStateSchema
>;

export type ArrowKeySelectionProps = Readonly<{
  'data-arrow-key-list': string;
  'data-arrow-key-orientation': Orientation;
}>;

function readStep({
  event,
  orientation,
}: Readonly<{ event: KeyboardEvent; orientation: Orientation }>): number | undefined {
  const stepKeys: Readonly<Record<string, number>> = STEP_KEYS[orientation];
  const isModified = event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
  const step = isModified || event.defaultPrevented ? undefined : stepKeys[event.key];
  return step;
}

function readIsKeyOwnedElsewhere(target: EventTarget | null): boolean {
  const isKeyOwnedElsewhere =
    target instanceof Element && target.closest(KEY_OWNER_SELECTOR) !== null;
  return isKeyOwnedElsewhere;
}

function readIsMovedByKey({
  target,
  list,
  orientation,
  isFocusRequired,
}: Readonly<{
  target: EventTarget | null;
  list: string;
  orientation: Orientation;
  isFocusRequired: boolean;
}>): boolean {
  const focusOwner =
    target instanceof Element
      ? target.closest('[data-arrow-key-list], [data-details-panel]')
      : null;
  const focusedRow =
    focusOwner === null || focusOwner.hasAttribute('data-arrow-key-list')
      ? focusOwner
      : document.getElementById(focusOwner.getAttribute('data-return-focus-id') ?? '');
  const isMovedByKey =
    focusedRow?.getAttribute('data-arrow-key-orientation') === orientation
      ? focusedRow.getAttribute('data-arrow-key-list') === list
      : !isFocusRequired;
  return isMovedByKey;
}

function readNextRow({
  target,
  list,
  step,
}: Readonly<{ target: EventTarget | null; list: string; step: number }>):
  HTMLAnchorElement | undefined {
  const rows = [
    ...document.querySelectorAll<HTMLAnchorElement>(`a[data-arrow-key-list="${list}"]`),
  ];
  const focusedIndex = rows.findIndex((row) => row === target);
  const selectedIndex = rows.findIndex((row) => row.getAttribute('aria-current') === 'true');
  const shownIndex = rows.findIndex((row) => row.hasAttribute('data-shown-by-default'));
  const currentIndex =
    focusedIndex >= 0 ? focusedIndex : selectedIndex >= 0 ? selectedIndex : shownIndex;
  const nextRow = rows[currentIndex + step];
  return nextRow;
}

export function useArrowKeySelection({
  list,
  orientation,
  isFocusRequired,
}: Readonly<{
  list: string;
  orientation: Orientation;
  isFocusRequired: boolean;
}>): ArrowKeySelectionProps {
  const navigate = useNavigate();
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const step = readStep({ event, orientation });
      if (
        step === undefined ||
        readIsKeyOwnedElsewhere(event.target) ||
        !readIsMovedByKey({ target: event.target, list, orientation, isFocusRequired })
      ) {
        return;
      }

      const nextRow = readNextRow({ target: event.target, list, step });
      if (nextRow === undefined) {
        return;
      }

      event.preventDefault();
      void navigate(
        { search: new URL(nextRow.href).search },
        { replace: true, preventScrollReset: true, state: ARROW_KEY_SELECTION_STATE },
      );
      nextRow.focus({ preventScroll: true });
      nextRow.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [list, orientation, isFocusRequired, navigate]);

  const selectionProps = { 'data-arrow-key-list': list, 'data-arrow-key-orientation': orientation };
  return selectionProps;
}

function readFocusedList(target: EventTarget | null): string | undefined {
  const focusedList =
    target instanceof Element
      ? (target.closest('[data-arrow-key-list]')?.getAttribute('data-arrow-key-list') ?? undefined)
      : undefined;
  return focusedList;
}

function readFocusTarget({
  rightList,
  isRightward,
}: Readonly<{ rightList: string; isRightward: boolean }>): HTMLAnchorElement | undefined {
  const rows = [
    ...document.querySelectorAll<HTMLAnchorElement>(
      'a[data-arrow-key-list][data-arrow-key-orientation="vertical"]',
    ),
  ].filter((row) => (row.getAttribute('data-arrow-key-list') === rightList) === isRightward);
  const focusTarget =
    rows.find((row) => row.getAttribute('aria-current') === 'true') ??
    rows.find((row) => row.hasAttribute('data-shown-by-default')) ??
    rows[0];
  return focusTarget;
}

export function useListFocusKeys({
  rightList,
  isEnabled,
}: Readonly<{ rightList: string; isEnabled: boolean }>): void {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const step = readStep({ event, orientation: 'horizontal' });
      if (!isEnabled || step === undefined || readIsKeyOwnedElsewhere(event.target)) {
        return;
      }

      const isRightward = step > 0;
      const focusedList = readFocusedList(event.target);
      const isInTargetSide =
        focusedList !== undefined && (focusedList === rightList) === isRightward;
      const focusTarget = isInTargetSide ? undefined : readFocusTarget({ rightList, isRightward });
      if (focusTarget === undefined) {
        return;
      }

      event.preventDefault();
      focusTarget.focus({ preventScroll: true });
      focusTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [rightList, isEnabled]);
}

export function readIsArrowKeySelection(locationState: unknown): boolean {
  const isArrowKeySelection = arrowKeySelectionStateSchema.safeParse(locationState).success;
  return isArrowKeySelection;
}
