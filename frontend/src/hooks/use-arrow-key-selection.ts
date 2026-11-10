import type { KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';

type Orientation = 'vertical' | 'horizontal';

const STEP_KEYS = {
  vertical: { ArrowDown: 1, ArrowUp: -1 },
  horizontal: { ArrowRight: 1, ArrowLeft: -1 },
} satisfies Readonly<Record<Orientation, Readonly<Record<string, number>>>>;

const arrowKeySelectionStateSchema = z.object({ isArrowKeySelection: z.literal(true) });

export type ArrowKeySelectionProps = Readonly<{
  'data-arrow-key-list': string;
  onKeyDown: (event: KeyboardEvent<HTMLAnchorElement>) => void;
}>;

function readStep({
  event,
  orientation,
}: Readonly<{ event: KeyboardEvent<HTMLAnchorElement>; orientation: Orientation }>):
  number | undefined {
  const stepKeys: Readonly<Record<string, number>> = STEP_KEYS[orientation];
  const isModified = event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
  const step = isModified ? undefined : stepKeys[event.key];
  return step;
}

function readNextRow({
  row,
  list,
  step,
}: Readonly<{ row: HTMLAnchorElement; list: string; step: number }>):
  HTMLAnchorElement | undefined {
  const rows = [
    ...document.querySelectorAll<HTMLAnchorElement>(`a[data-arrow-key-list="${list}"]`),
  ];
  const nextRow = rows[rows.indexOf(row) + step];
  return nextRow;
}

export function useArrowKeySelection({
  list,
  orientation,
}: Readonly<{ list: string; orientation: Orientation }>): ArrowKeySelectionProps {
  const navigate = useNavigate();
  function handleKeyDown(event: KeyboardEvent<HTMLAnchorElement>) {
    const step = readStep({ event, orientation });
    if (step === undefined) {
      return;
    }

    const nextRow = readNextRow({ row: event.currentTarget, list, step });
    if (nextRow === undefined) {
      return;
    }

    event.preventDefault();
    void navigate(
      { search: new URL(nextRow.href).search },
      {
        replace: true,
        preventScrollReset: true,
        state: { isArrowKeySelection: true } satisfies z.infer<typeof arrowKeySelectionStateSchema>,
      },
    );
    nextRow.focus();
  }

  const selectionProps = { 'data-arrow-key-list': list, onKeyDown: handleKeyDown };
  return selectionProps;
}

export function readIsArrowKeySelection(locationState: unknown): boolean {
  const isArrowKeySelection = arrowKeySelectionStateSchema.safeParse(locationState).success;
  return isArrowKeySelection;
}
