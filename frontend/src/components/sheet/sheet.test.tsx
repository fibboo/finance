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
    releaseTime: 1100,
    isClosed: true,
  },
  {
    name: 'a slow drag short of 30% of the height keeps it open',
    pointerName: 'TouchA',
    moves: [
      { clientY: 290, time: 1000 },
      { clientY: 279, time: 1100 },
    ],
    releaseTime: 1100,
    isClosed: false,
  },
  {
    name: 'a flick faster than 0.5px per ms closes it',
    pointerName: 'TouchA',
    moves: [{ clientY: 151, time: 100 }],
    releaseTime: 100,
    isClosed: true,
  },
  {
    name: 'a move slower than 0.5px per ms keeps it open',
    pointerName: 'TouchA',
    moves: [{ clientY: 149, time: 100 }],
    releaseTime: 100,
    isClosed: false,
  },
  {
    name: 'a flick released within 100ms closes it',
    pointerName: 'TouchA',
    moves: [{ clientY: 151, time: 100 }],
    releaseTime: 199,
    isClosed: true,
  },
  {
    name: 'a flick held still for over 100ms keeps it open',
    pointerName: 'TouchA',
    moves: [{ clientY: 151, time: 100 }],
    releaseTime: 201,
    isClosed: false,
  },
  {
    name: 'a fast move of over 16px closes it',
    pointerName: 'TouchA',
    moves: [{ clientY: 117, time: 10 }],
    releaseTime: 10,
    isClosed: true,
  },
  {
    name: 'a fast move of under 16px keeps it open',
    pointerName: 'TouchA',
    moves: [{ clientY: 115, time: 10 }],
    releaseTime: 10,
    isClosed: false,
  },
  {
    name: 'a drag past 30% that ends moving up slower than 0.5px per ms closes it',
    pointerName: 'TouchA',
    moves: [
      { clientY: 400, time: 1000 },
      { clientY: 351, time: 1100 },
    ],
    releaseTime: 1100,
    isClosed: true,
  },
  {
    name: 'a drag past 30% that ends in a flick up keeps it open',
    pointerName: 'TouchA',
    moves: [
      { clientY: 400, time: 1000 },
      { clientY: 349, time: 1100 },
    ],
    releaseTime: 1100,
    isClosed: false,
  },
  {
    name: 'a drag past 30% that ends moving up under 16px closes it',
    pointerName: 'TouchA',
    moves: [
      { clientY: 400, time: 1000 },
      { clientY: 385, time: 1010 },
    ],
    releaseTime: 1010,
    isClosed: true,
  },
  {
    name: 'a drag past 30% that ends moving up over 16px keeps it open',
    pointerName: 'TouchA',
    moves: [
      { clientY: 400, time: 1000 },
      { clientY: 383, time: 1010 },
    ],
    releaseTime: 1010,
    isClosed: false,
  },
  {
    name: 'a mouse drag keeps it open',
    pointerName: 'mouse',
    moves: [{ clientY: 500, time: 100 }],
    releaseTime: 100,
    isClosed: false,
  },
])('$name', async ({ pointerName, moves, releaseTime, isClosed }) => {
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
  vi.setSystemTime(releaseTime);
  await user.pointer({ keys: `[/${pressKey}]` });

  // assert
  expect(onClose).toHaveBeenCalledTimes(isClosed ? 1 : 0);
  offsetHeight.mockRestore();
  vi.useRealTimers();
});

test('closes on a tap on the backdrop once the press is released', async () => {
  // arrange
  const user = userEvent.setup();
  const onClose = vi.fn();
  render(
    <Sheet label="New transaction" onClose={onClose}>
      <h2>Expense</h2>
    </Sheet>,
  );
  const sheet = screen.getByRole('dialog', { name: 'New transaction' });
  await user.pointer({ keys: '[TouchA>]', target: sheet });
  expect(onClose).not.toHaveBeenCalled();

  // act
  await user.pointer({ keys: '[/TouchA]' });

  // assert
  expect(onClose).toHaveBeenCalledOnce();
});

test('stays open when a press that started inside is released on the backdrop', async () => {
  // arrange
  const user = userEvent.setup();
  const onClose = vi.fn();
  render(
    <Sheet label="New transaction" onClose={onClose}>
      <h2>Expense</h2>
    </Sheet>,
  );
  await user.pointer({
    keys: '[MouseLeft>]',
    target: screen.getByRole('heading', { name: 'Expense' }),
  });

  // act
  await user.pointer({
    keys: '[/MouseLeft]',
    target: screen.getByRole('dialog', { name: 'New transaction' }),
  });

  // assert
  expect(onClose).not.toHaveBeenCalled();
});
