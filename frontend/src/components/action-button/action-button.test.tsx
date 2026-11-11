import { act, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { expect, onTestFinished, test, vi } from 'vitest';

import { ActionButton } from '@/components/action-button/action-button';
import { DELETE_ICON_PATH } from '@/components/action-button/action-icons';
import { render } from '@/test/render';

const HINT = 'Bring the balance to zero to delete.';

test('runs its action when it is not blocked', async () => {
  // arrange
  const user = userEvent.setup();
  const onClick = vi.fn();
  render(
    <ActionButton
      label="Delete account"
      iconPath={DELETE_ICON_PATH}
      isDanger
      action={{ kind: 'button', blockingHint: undefined, onClick }}
    />,
  );

  // act
  await user.click(screen.getByRole('button', { name: 'Delete account' }));

  // assert
  expect(onClick).toHaveBeenCalledOnce();
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});

test('ignores a tap while blocked and shows the reason over it', async () => {
  // arrange
  const user = userEvent.setup();
  const onClick = vi.fn();
  render(
    <ActionButton
      label="Delete account"
      iconPath={DELETE_ICON_PATH}
      isDanger
      action={{ kind: 'button', blockingHint: HINT, onClick }}
    />,
  );
  const button = screen.getByRole('button', { name: 'Delete account' });

  // act
  await user.pointer({ keys: '[TouchA]', target: button });

  // assert
  expect(onClick).not.toHaveBeenCalled();
  expect(button).toHaveAttribute('aria-disabled', 'true');
  expect(button).toHaveAccessibleDescription(HINT);
  expect(screen.getByRole('tooltip')).toHaveTextContent(HINT);
});

test('closes the reason on the next tap elsewhere without activating what is tapped', async () => {
  // arrange
  const user = userEvent.setup();
  const onEdit = vi.fn();
  render(
    <>
      <ActionButton
        label="Delete account"
        iconPath={DELETE_ICON_PATH}
        isDanger
        action={{ kind: 'button', blockingHint: HINT, onClick: vi.fn() }}
      />
      <button type="button" onClick={onEdit}>
        Edit
      </button>
    </>,
  );
  await user.pointer({
    keys: '[TouchA]',
    target: screen.getByRole('button', { name: 'Delete account' }),
  });

  // act
  await user.pointer({ keys: '[TouchA]', target: screen.getByRole('button', { name: 'Edit' }) });

  // assert
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  expect(onEdit).not.toHaveBeenCalled();
  // the next tap reaches the control
  await user.pointer({ keys: '[TouchA]', target: screen.getByRole('button', { name: 'Edit' }) });
  expect(onEdit).toHaveBeenCalledOnce();
});

test('closes the reason a few seconds after a tap', async () => {
  // arrange
  render(
    <ActionButton
      label="Delete account"
      iconPath={DELETE_ICON_PATH}
      isDanger
      action={{ kind: 'button', blockingHint: HINT, onClick: vi.fn() }}
    />,
  );
  const button = screen.getByRole('button', { name: 'Delete account' });
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'], shouldAdvanceTime: true });
  onTestFinished(() => {
    vi.useRealTimers();
  });
  const user = userEvent.setup();
  await user.pointer({ keys: '[TouchA]', target: button });

  // act
  act(() => {
    vi.advanceTimersByTime(3000);
  });

  // assert
  expect(screen.getByRole('tooltip')).toHaveTextContent(HINT);
  act(() => {
    vi.advanceTimersByTime(1000);
  });
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});

test('closes the reason on Escape', async () => {
  // arrange
  const user = userEvent.setup();
  render(
    <ActionButton
      label="Delete account"
      iconPath={DELETE_ICON_PATH}
      isDanger
      action={{ kind: 'button', blockingHint: HINT, onClick: vi.fn() }}
    />,
  );
  await user.click(screen.getByRole('button', { name: 'Delete account' }));

  // act
  await user.keyboard('{Escape}');

  // assert
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});

test('shows the reason while the pointer rests on it', async () => {
  // arrange
  const user = userEvent.setup();
  render(
    <ActionButton
      label="Delete account"
      iconPath={DELETE_ICON_PATH}
      isDanger
      action={{ kind: 'button', blockingHint: HINT, onClick: vi.fn() }}
    />,
  );
  const button = screen.getByRole('button', { name: 'Delete account' });

  // act
  await user.hover(button);

  // assert
  expect(screen.getByRole('tooltip')).toHaveTextContent(HINT);
  await user.unhover(button);
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});

test('shows the reason while it has the focus', async () => {
  // arrange
  const user = userEvent.setup();
  render(
    <ActionButton
      label="Delete account"
      iconPath={DELETE_ICON_PATH}
      isDanger
      action={{ kind: 'button', blockingHint: HINT, onClick: vi.fn() }}
    />,
  );

  // act
  await user.tab();

  // assert
  expect(screen.getByRole('tooltip')).toHaveTextContent(HINT);
  await user.tab();
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});
