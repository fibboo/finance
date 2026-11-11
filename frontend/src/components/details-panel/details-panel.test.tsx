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
      onRetry={vi.fn()}
      onClose={onClose}
      onChoose={vi.fn()}
      renderContent={() => <p>Groceries</p>}
    />,
  );
  await user.pointer({ keys: '[TouchA>]', target: screen.getByTestId('details-panel-backdrop') });
  expect(onClose).not.toHaveBeenCalled();

  // act
  await user.pointer({ keys: '[/TouchA]' });

  // assert
  expect(onClose).toHaveBeenCalledOnce();
});
