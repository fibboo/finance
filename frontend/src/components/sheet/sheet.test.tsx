import { screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';

import { render } from '@/test/render';

import { Sheet } from './sheet';

test.each([
  {
    name: 'a slow drag past 30% of the height closes it',
    pointerName: 'TouchA',
    moves: [
      { clientY: 290, time: 1000 },
      { clientY: 281, time: 1100 },
    ],
    isClosed: true,
  },
  {
    name: 'a slow drag short of 30% of the height keeps it open',
    pointerName: 'TouchA',
    moves: [
      { clientY: 290, time: 1000 },
      { clientY: 279, time: 1100 },
    ],
    isClosed: false,
  },
  {
    name: 'a flick faster than 0.5px per ms closes it',
    pointerName: 'TouchA',
    moves: [{ clientY: 151, time: 100 }],
    isClosed: true,
  },
  {
    name: 'a move slower than 0.5px per ms keeps it open',
    pointerName: 'TouchA',
    moves: [{ clientY: 149, time: 100 }],
    isClosed: false,
  },
  {
    name: 'a mouse drag keeps it open',
    pointerName: 'mouse',
    moves: [{ clientY: 500, time: 100 }],
    isClosed: false,
  },
])('$name', async ({ pointerName, moves, isClosed }) => {
  // arrange
  // the sheet is 600px tall, and the drag starts at 100px at time 0
  vi.setSystemTime(0);
  const offsetHeight = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(600);
  const user = userEvent.setup();
  const onClose = vi.fn();
  render(
    <Sheet label="New transaction" onClose={onClose}>
      <div data-sheet-drag-area>
        <h2>New transaction</h2>
      </div>
    </Sheet>,
  );
  const pressKey = pointerName === 'mouse' ? 'MouseLeft' : pointerName;
  await user.pointer({
    keys: `[${pressKey}>]`,
    target: screen.getByRole('heading', { name: 'New transaction' }),
    coords: { clientY: 100 },
  });

  // act
  for (const move of moves) {
    vi.setSystemTime(move.time);
    await user.pointer({ pointerName, coords: { clientY: move.clientY } });
  }
  await user.pointer({ keys: `[/${pressKey}]` });

  // assert
  expect(onClose).toHaveBeenCalledTimes(isClosed ? 1 : 0);
  offsetHeight.mockRestore();
  vi.useRealTimers();
});
