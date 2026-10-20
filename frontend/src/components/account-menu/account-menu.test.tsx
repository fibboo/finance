import { screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { expect, test } from 'vitest';

import { AccountMenu } from '@/components/account-menu/account-menu';
import { render } from '@/test/render';

test('opens the menu with its content and moves focus into it', async () => {
  // arrange
  const user = userEvent.setup();
  render(<AccountMenu>Menu content</AccountMenu>);

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
  render(<AccountMenu>Menu content</AccountMenu>);
  await user.click(screen.getByRole('button', { name: 'Account menu' }));

  // act
  await user.keyboard('{Escape}');

  // assert
  expect(screen.queryByRole('dialog', { name: 'Account' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Account menu' })).toHaveFocus();
});

test('closes on a click outside the menu', async () => {
  // arrange
  const user = userEvent.setup();
  render(<AccountMenu>Menu content</AccountMenu>);
  await user.click(screen.getByRole('button', { name: 'Account menu' }));

  // act
  await user.click(document.body);

  // assert
  expect(screen.queryByRole('dialog', { name: 'Account' })).not.toBeInTheDocument();
});

test('closes on a second click of the avatar', async () => {
  // arrange
  const user = userEvent.setup();
  render(<AccountMenu>Menu content</AccountMenu>);
  await user.click(screen.getByRole('button', { name: 'Account menu' }));

  // act
  await user.click(screen.getByRole('button', { name: 'Close account menu' }));

  // assert
  expect(screen.queryByRole('dialog', { name: 'Account' })).not.toBeInTheDocument();
});
