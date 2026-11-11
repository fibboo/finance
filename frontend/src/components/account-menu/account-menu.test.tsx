import { screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';

import { AccountMenu } from '@/components/account-menu/account-menu';
import { render } from '@/test/render';

test('opens the menu with its content and moves focus into it', async () => {
  // arrange
  const user = userEvent.setup();
  render(<AccountMenu avatar="NI">Menu content</AccountMenu>);

  // act
  await user.click(screen.getByRole('button', { name: 'Account menu' }));

  // assert
  expect(screen.getByRole('dialog', { name: 'Account' })).toHaveFocus();
  expect(screen.getByText('Menu content')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Close account menu' })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
});

test('closes on Escape and returns focus to the avatar', async () => {
  // arrange
  const user = userEvent.setup();
  render(<AccountMenu avatar="NI">Menu content</AccountMenu>);
  await user.click(screen.getByRole('button', { name: 'Account menu' }));

  // act
  await user.keyboard('{Escape}');

  // assert
  expect(screen.queryByRole('dialog', { name: 'Account' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Account menu' })).toHaveFocus();
});

test('closes on a tap on the backdrop outside the menu', async () => {
  // arrange
  const user = userEvent.setup();
  render(<AccountMenu avatar="NI">Menu content</AccountMenu>);
  await user.click(screen.getByRole('button', { name: 'Account menu' }));

  // act
  await user.click(screen.getByTestId('account-menu-backdrop'));

  // assert
  expect(screen.queryByRole('dialog', { name: 'Account' })).not.toBeInTheDocument();
});

test('stays open while the press outside the menu is held', async () => {
  // arrange
  const user = userEvent.setup();
  render(<AccountMenu avatar="NI">Menu content</AccountMenu>);
  await user.click(screen.getByRole('button', { name: 'Account menu' }));

  // act
  await user.pointer({ keys: '[TouchA>]', target: screen.getByTestId('account-menu-backdrop') });

  // assert
  expect(screen.getByRole('dialog', { name: 'Account' })).toBeInTheDocument();
});

test('closes on a tap on a control outside the menu without activating it', async () => {
  // arrange
  const user = userEvent.setup();
  const onClick = vi.fn();
  render(
    <>
      <AccountMenu avatar="NI">Menu content</AccountMenu>
      <button type="button" onClick={onClick}>
        New transaction
      </button>
    </>,
  );
  await user.click(screen.getByRole('button', { name: 'Account menu' }));

  // act
  await user.pointer({
    keys: '[TouchA]',
    target: screen.getByRole('button', { name: 'New transaction' }),
  });

  // assert
  expect(screen.queryByRole('dialog', { name: 'Account' })).not.toBeInTheDocument();
  expect(onClick).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Account menu' })).toHaveFocus();
  // the next tap reaches the control
  await user.pointer({
    keys: '[TouchA]',
    target: screen.getByRole('button', { name: 'New transaction' }),
  });
  expect(onClick).toHaveBeenCalledOnce();
});

test('closes on the press of a right click outside the menu', async () => {
  // arrange
  const user = userEvent.setup();
  render(<AccountMenu avatar="NI">Menu content</AccountMenu>);
  await user.click(screen.getByRole('button', { name: 'Account menu' }));

  // act
  await user.pointer({
    keys: '[MouseRight>]',
    target: screen.getByTestId('account-menu-backdrop'),
  });

  // assert
  expect(screen.queryByRole('dialog', { name: 'Account' })).not.toBeInTheDocument();
});

test('closes on a second click of the avatar', async () => {
  // arrange
  const user = userEvent.setup();
  render(<AccountMenu avatar="NI">Menu content</AccountMenu>);
  await user.click(screen.getByRole('button', { name: 'Account menu' }));

  // act
  await user.click(screen.getByRole('button', { name: 'Close account menu' }));

  // assert
  expect(screen.queryByRole('dialog', { name: 'Account' })).not.toBeInTheDocument();
});
