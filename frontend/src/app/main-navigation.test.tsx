import { screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { MainNavigation } from '@/app/main-navigation';
import { render } from '@/test/render';

test('marks Home as the current section', () => {
  // act
  render(
    <MainNavigation
      menuState="full"
      menuToggleRef={{ current: null }}
      onMenuToggle={() => undefined}
      onSectionChoose={() => undefined}
    />,
  );

  // assert
  expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
});

test('links Transactions to its section', () => {
  // act
  render(
    <MainNavigation
      menuState="full"
      menuToggleRef={{ current: null }}
      onMenuToggle={() => undefined}
      onSectionChoose={() => undefined}
    />,
  );

  // assert
  expect(screen.getByRole('link', { name: 'Transactions' })).toHaveAttribute(
    'href',
    '/transactions',
  );
});

test('links Accounts to its section', () => {
  // act
  render(
    <MainNavigation
      menuState="full"
      menuToggleRef={{ current: null }}
      onMenuToggle={() => undefined}
      onSectionChoose={() => undefined}
    />,
  );

  // assert
  expect(screen.getByRole('link', { name: 'Accounts' })).toHaveAttribute('href', '/accounts');
});

test('links Categories to its section', () => {
  // act
  render(
    <MainNavigation
      menuState="full"
      menuToggleRef={{ current: null }}
      onMenuToggle={() => undefined}
      onSectionChoose={() => undefined}
    />,
  );

  // assert
  expect(screen.getByRole('link', { name: 'Categories' })).toHaveAttribute('href', '/categories');
});

test.each(['Locations Soon', 'Income sources Soon'])(
  'keeps %s of More disabled until its screen exists',
  (name) => {
    // act
    render(
      <MainNavigation
        menuState="full"
        menuToggleRef={{ current: null }}
        onMenuToggle={() => undefined}
        onSectionChoose={() => undefined}
      />,
    );

    // assert
    expect(screen.getByRole('button', { name })).toBeDisabled();
  },
);

test.each(['/locations', '/income-sources'])('marks More as current on %s', (path) => {
  // act
  render(
    <MainNavigation
      menuState="full"
      menuToggleRef={{ current: null }}
      onMenuToggle={() => undefined}
      onSectionChoose={() => undefined}
    />,
    { initialEntries: [path] },
  );

  // assert
  expect(screen.getByRole('button', { name: 'More' })).toHaveAttribute('aria-current', 'page');
});

test('leaves More unmarked on a section of the bar', () => {
  // act
  render(
    <MainNavigation
      menuState="full"
      menuToggleRef={{ current: null }}
      onMenuToggle={() => undefined}
      onSectionChoose={() => undefined}
    />,
    { initialEntries: ['/accounts'] },
  );

  // assert
  expect(screen.getByRole('button', { name: 'More' })).not.toHaveAttribute('aria-current');
});

test.each(['Home', 'Transactions', 'Accounts', 'Categories'])(
  'names %s of the collapsed menu and titles it',
  (name) => {
    // act
    render(
      <MainNavigation
        menuState="collapsed"
        menuToggleRef={{ current: null }}
        onMenuToggle={() => undefined}
        onSectionChoose={() => undefined}
      />,
    );

    // assert
    expect(screen.getByRole('link', { name })).toHaveAttribute('title', name);
  },
);

test('names Add transaction of the collapsed menu and titles it', () => {
  // act
  render(
    <MainNavigation
      menuState="collapsed"
      menuToggleRef={{ current: null }}
      onMenuToggle={() => undefined}
      onSectionChoose={() => undefined}
    />,
  );

  // assert
  expect(screen.getByRole('button', { name: 'Add transaction' })).toHaveAttribute(
    'title',
    'Add transaction',
  );
});

test.each([
  { menuState: 'full', isExpanded: 'true' },
  { menuState: 'collapsed', isExpanded: 'false' },
] as const)(
  'marks the menu button expanded as $isExpanded in the $menuState menu',
  ({ menuState, isExpanded }) => {
    // act
    render(
      <MainNavigation
        menuState={menuState}
        menuToggleRef={{ current: null }}
        onMenuToggle={() => undefined}
        onSectionChoose={() => undefined}
      />,
    );

    // assert
    expect(
      screen.getByRole('button', {
        name: menuState === 'full' ? 'Collapse' : 'Show the full menu',
      }),
    ).toHaveAttribute('aria-expanded', isExpanded);
  },
);
