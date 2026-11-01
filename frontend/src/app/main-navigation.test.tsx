import { screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { MainNavigation } from '@/app/main-navigation';
import { render } from '@/test/render';

test('marks Home as the current section', () => {
  // act
  render(<MainNavigation />);

  // assert
  expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
});

test('links Transactions to its section', () => {
  // act
  render(<MainNavigation />);

  // assert
  expect(screen.getByRole('link', { name: 'Transactions' })).toHaveAttribute(
    'href',
    '/transactions',
  );
});

test.each(['Accounts', 'Categories'])(
  'keeps %s disabled and marked Soon until its screen exists',
  (section) => {
    // act
    render(<MainNavigation />);

    // assert
    expect(screen.getByRole('button', { name: `${section} Soon` })).toBeDisabled();
  },
);
