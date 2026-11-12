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

test('links Accounts to its section', () => {
  // act
  render(<MainNavigation />);

  // assert
  expect(screen.getByRole('link', { name: 'Accounts' })).toHaveAttribute('href', '/accounts');
});

test('keeps Categories disabled and marked Soon until its screen exists', () => {
  // act
  render(<MainNavigation />);

  // assert
  expect(screen.getByRole('button', { name: 'Categories Soon' })).toBeDisabled();
});

test.each(['Locations Soon', 'Income sources Soon'])(
  'keeps %s of More disabled until its screen exists',
  (name) => {
    // act
    render(<MainNavigation />);

    // assert
    expect(screen.getByRole('button', { name })).toBeDisabled();
  },
);

test.each(['/locations', '/income-sources'])('marks More as current on %s', (path) => {
  // act
  render(<MainNavigation />, { initialEntries: [path] });

  // assert
  expect(screen.getByRole('button', { name: 'More' })).toHaveAttribute('aria-current', 'page');
});

test('leaves More unmarked on a section of the bar', () => {
  // act
  render(<MainNavigation />, { initialEntries: ['/accounts'] });

  // assert
  expect(screen.getByRole('button', { name: 'More' })).not.toHaveAttribute('aria-current');
});
