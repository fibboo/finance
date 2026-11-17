import { screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';

import { DetailsPanel } from '@/components/details-panel/details-panel';
import { render } from '@/test/render';

test('closes on a tap on the backdrop once the press is released', async () => {
  // arrange
  const user = userEvent.setup();
  const onClose = vi.fn();
  render(
    <DetailsPanel
      label="Transaction details"
      isLoaded
      isError={false}
      isFetching={false}
      isReplacing={false}
      isShownByDefault={false}
      isKeptOpenOnDesktop={false}
      errorMessage="Could not load the transaction."
      returnFocusId="transaction-1"
      arrowKeyList={undefined}
      back={undefined}
      onRetry={vi.fn()}
      onClose={onClose}
      onChoose={vi.fn()}
      renderContent={() => <p>Groceries</p>}
      renderSkeleton={undefined}
    />,
  );
  await user.pointer({ keys: '[TouchA>]', target: screen.getByTestId('details-panel-backdrop') });
  expect(onClose).not.toHaveBeenCalled();

  // act
  await user.pointer({ keys: '[/TouchA]' });

  // assert
  expect(onClose).toHaveBeenCalledOnce();
});

test.each(['Account details', 'Transaction details'])(
  '%s can be dismissed by another swipe when its panel is reused',
  async (label) => {
    // arrange
    vi.setSystemTime(0);
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <DetailsPanel
        label={label}
        isLoaded
        isError={false}
        isFetching={false}
        isReplacing={false}
        isShownByDefault={false}
        isKeptOpenOnDesktop={false}
        errorMessage="Could not load the details."
        returnFocusId="entry-1"
        arrowKeyList={undefined}
        back={undefined}
        onRetry={vi.fn()}
        onClose={onClose}
        onChoose={vi.fn()}
        renderContent={() => <h2 data-sheet-drag-area>Groceries</h2>}
        renderSkeleton={undefined}
      />,
    );

    // act
    for (const time of [0, 1000]) {
      vi.setSystemTime(time);
      await user.pointer({
        keys: '[TouchA>]',
        target: screen.getByRole('heading', { name: 'Groceries' }),
        coords: { clientY: 100 },
      });
      vi.setSystemTime(time + 100);
      await user.pointer({ pointerName: 'TouchA', coords: { clientY: 200 } });
      await user.pointer({ keys: '[/TouchA]' });
    }

    // assert
    expect(onClose).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  },
);
