import { screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { expect, test } from 'vitest';

import { MoreMenu } from '@/app/more-menu';
import { render } from '@/test/render';

test('opens the menu of its sections', async () => {
  // arrange
  const user = userEvent.setup();
  render(<MoreMenu isCurrent={false}>Sections</MoreMenu>);

  // act
  await user.click(screen.getByRole('button', { name: 'More' }));

  // assert
  expect(screen.getByRole('button', { name: 'More' })).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByText('Sections')).toBeInTheDocument();
});

test('closes when More is pressed again', async () => {
  // arrange
  const user = userEvent.setup();
  render(<MoreMenu isCurrent={false}>Sections</MoreMenu>);
  await user.click(screen.getByRole('button', { name: 'More' }));

  // act
  await user.click(screen.getByRole('button', { name: 'More' }));

  // assert
  expect(screen.getByRole('button', { name: 'More' })).toHaveAttribute('aria-expanded', 'false');
});

test('closes on Escape and returns focus to More', async () => {
  // arrange
  const user = userEvent.setup();
  render(<MoreMenu isCurrent={false}>Sections</MoreMenu>);
  await user.click(screen.getByRole('button', { name: 'More' }));

  // act
  await user.keyboard('{Escape}');

  // assert
  expect(screen.getByRole('button', { name: 'More' })).toHaveAttribute('aria-expanded', 'false');
  expect(screen.getByRole('button', { name: 'More' })).toHaveFocus();
});

test('closes on a click outside the menu', async () => {
  // arrange
  const user = userEvent.setup();
  render(
    <>
      <MoreMenu isCurrent={false}>Sections</MoreMenu>
      <button type="button">Outside</button>
    </>,
  );
  await user.click(screen.getByRole('button', { name: 'More' }));

  // act
  await user.click(screen.getByRole('button', { name: 'Outside' }));

  // assert
  expect(screen.getByRole('button', { name: 'More' })).toHaveAttribute('aria-expanded', 'false');
});

test('stays open on a click on one of its sections', async () => {
  // arrange
  const user = userEvent.setup();
  render(<MoreMenu isCurrent={false}>Sections</MoreMenu>);
  await user.click(screen.getByRole('button', { name: 'More' }));

  // act
  await user.click(screen.getByText('Sections'));

  // assert
  expect(screen.getByRole('button', { name: 'More' })).toHaveAttribute('aria-expanded', 'true');
});

test('marks More as current while one of its sections is open', () => {
  // act
  render(<MoreMenu isCurrent>Sections</MoreMenu>);

  // assert
  expect(screen.getByRole('button', { name: 'More' })).toHaveAttribute('aria-current', 'page');
});
