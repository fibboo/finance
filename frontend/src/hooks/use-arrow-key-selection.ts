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
  const currentIndex = focusedIndex >= 0 ? focusedIndex : Math.max(selectedIndex, 0);
  const nextRow = rows[currentIndex + step];
  return nextRow;
}

export function useArrowKeySelection({
  list,
  orientation,
}: Readonly<{ list: string; orientation: Orientation }>): ArrowKeySelectionProps {
  const navigate = useNavigate();
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const step = readStep({ event, orientation });
      if (step === undefined || readIsKeyOwnedElsewhere(event.target)) {
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
  }, [list, orientation, navigate]);

  const selectionProps = { 'data-arrow-key-list': list };
  return selectionProps;
}

export function readIsArrowKeySelection(locationState: unknown): boolean {
  const isArrowKeySelection = arrowKeySelectionStateSchema.safeParse(locationState).success;
  return isArrowKeySelection;
}
