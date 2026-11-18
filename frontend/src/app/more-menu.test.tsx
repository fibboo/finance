import { screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { Link } from 'react-router';
import { expect, test } from 'vitest';

import { MoreMenu } from '@/app/more-menu';
import { render } from '@/test/render';

test('opens the menu of its sections', async () => {
  // arrange
  const user = userEvent.setup();
  render(<MoreMenu isCurrent={false} renderSections={() => 'Sections'} />);

  // act
  await user.click(screen.getByRole('button', { name: 'More' }));

  // assert
  expect(screen.getByRole('button', { name: 'More' })).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByText('Sections')).toBeInTheDocument();
});

test('closes when More is pressed again', async () => {
  // arrange
  const user = userEvent.setup();
  render(<MoreMenu isCurrent={false} renderSections={() => 'Sections'} />);
  await user.click(screen.getByRole('button', { name: 'More' }));

  // act
  await user.click(screen.getByRole('button', { name: 'More' }));

  // assert
  expect(screen.getByRole('button', { name: 'More' })).toHaveAttribute('aria-expanded', 'false');
});

test('closes on Escape and returns focus to More', async () => {
  // arrange
  const user = userEvent.setup();
  render(<MoreMenu isCurrent={false} renderSections={() => 'Sections'} />);
  await user.click(screen.getByRole('button', { name: 'More' }));

  // act
  await user.keyboard('{Escape}');

  // assert
  expect(screen.getByRole('button', { name: 'More' })).toHaveAttribute('aria-expanded', 'false');
  expect(screen.getByRole('button', { name: 'More' })).toHaveFocus();
});

test('closes on an outside click without focusing the control underneath', async () => {
  // arrange
  const user = userEvent.setup();
  render(
    <>
      <MoreMenu isCurrent={false} renderSections={() => 'Sections'} />
      <button type="button">Outside</button>
    </>,
  );
  await user.click(screen.getByRole('button', { name: 'More' }));

  // act
  await user.click(screen.getByRole('button', { name: 'Outside' }));

  // assert
  expect(screen.getByRole('button', { name: 'More' })).toHaveAttribute('aria-expanded', 'false');
  expect(screen.getByRole('button', { name: 'Outside' })).not.toHaveFocus();
  expect(screen.getByRole('button', { name: 'More' })).toHaveFocus();
});

test.each(['[MouseLeft>]', '[TouchA>]'])(
  'blocks an outside field while the press %s is held',
  async (keys) => {
    // arrange
    const user = userEvent.setup();
    render(
      <>
        <MoreMenu isCurrent={false} renderSections={() => 'Sections'} />
        <label>
          Search accounts
          <input type="search" />
        </label>
      </>,
    );
    await user.click(screen.getByRole('button', { name: 'More' }));

    // act
    await user.pointer({
      keys,
      target: screen.getByRole('searchbox', { name: 'Search accounts' }),
    });

    // assert
    expect(screen.getByRole('button', { name: 'More' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('searchbox', { name: 'Search accounts' })).not.toHaveFocus();
    expect(screen.getByRole('button', { name: 'More' })).toHaveFocus();
  },
);

test('dismisses on the backdrop without passing focus to the page', async () => {
  // arrange
  const user = userEvent.setup();
  render(<MoreMenu isCurrent={false} renderSections={() => 'Sections'} />);
  await user.click(screen.getByRole('button', { name: 'More' }));

  // act
  await user.pointer({ keys: '[TouchA]', target: screen.getByTestId('more-menu-backdrop') });

  // assert
  expect(screen.getByRole('button', { name: 'More' })).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByTestId('more-menu-backdrop')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'More' })).toHaveFocus();
});

test('stays open on a click on one of its sections', async () => {
  // arrange
  const user = userEvent.setup();
  render(<MoreMenu isCurrent={false} renderSections={() => 'Sections'} />);
  await user.click(screen.getByRole('button', { name: 'More' }));

  // act
  await user.click(screen.getByText('Sections'));

  // assert
  expect(screen.getByRole('button', { name: 'More' })).toHaveAttribute('aria-expanded', 'true');
});

test.each(['click', 'tap'])(
  'only dismisses More on an outside account-link %s',
  async (interaction) => {
    // arrange
    const user = userEvent.setup();
    const { router } = render(
      <>
        <MoreMenu isCurrent={false} renderSections={() => 'Sections'} />
        <Link to="?account=wallet">Wallet</Link>
      </>,
    );
    await user.click(screen.getByRole('button', { name: 'More' }));
    const account = screen.getByRole('link', { name: 'Wallet' });

    // act
    if (interaction === 'tap') {
      await user.pointer({ keys: '[TouchA]', target: account });
    } else {
      await user.click(account);
    }

    // assert
    expect(screen.getByRole('button', { name: 'More' })).toHaveAttribute('aria-expanded', 'false');
    expect(router.state.location.search).toBe('');
    if (interaction === 'tap') {
      await user.pointer({ keys: '[TouchA]', target: account });
    } else {
      await user.click(account);
    }
    expect(router.state.location.search).toBe('?account=wallet');
  },
);

test('marks More as current while one of its sections is open', () => {
  // act
  render(<MoreMenu isCurrent renderSections={() => 'Sections'} />);

  // assert
  expect(screen.getByRole('button', { name: 'More' })).toHaveAttribute('aria-current', 'page');
});
