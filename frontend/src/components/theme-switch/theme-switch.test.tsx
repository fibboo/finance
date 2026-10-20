import { screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { expect, test } from 'vitest';

import { ThemeSwitch } from '@/components/theme-switch/theme-switch';
import { render } from '@/test/render';

test('follows the device setting by default', () => {
  // act
  render(<ThemeSwitch />);

  // assert
  expect(screen.getByRole('radio', { name: 'System' })).toBeChecked();
  expect(screen.getByText('Follows your device setting.')).toBeInTheDocument();
  expect(document.documentElement).toHaveAttribute('data-theme', 'light');
});

test('switches to the chosen theme', async () => {
  // arrange
  const user = userEvent.setup();
  render(<ThemeSwitch />);

  // act
  await user.click(screen.getByRole('radio', { name: 'Dark' }));

  // assert
  expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked();
  expect(screen.getByText('Kept on this device.')).toBeInTheDocument();
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
});

test('restores the choice kept in this browser', () => {
  // arrange
  localStorage.setItem('theme', 'dark');

  // act
  render(<ThemeSwitch />);

  // assert
  expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked();
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
});

test('falls back to the device setting when the kept choice is unknown', () => {
  // arrange
  localStorage.setItem('theme', 'sepia');

  // act
  render(<ThemeSwitch />);

  // assert
  expect(screen.getByRole('radio', { name: 'System' })).toBeChecked();
  expect(document.documentElement).toHaveAttribute('data-theme', 'light');
});
