import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';

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

test.each([
  { name: 'Locations', path: '/locations' },
  { name: 'Income sources', path: '/income-sources' },
])('links $name of More to its section and marks it current there', ({ name, path }) => {
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
  const section = screen.getByRole('link', { name });
  expect(section).toHaveAttribute('href', path);
  expect(section).toHaveAttribute('aria-current', 'page');
});

test.each(['/accounts', '/income-sources'])(
  'closes More and reports the choice when Income sources is chosen on %s',
  async (path) => {
    // arrange
    const user = userEvent.setup();
    const onSectionChoose = vi.fn();
    const { router } = render(
      <MainNavigation
        menuState="full"
        menuToggleRef={{ current: null }}
        onMenuToggle={() => undefined}
        onSectionChoose={onSectionChoose}
      />,
      { initialEntries: [path] },
    );
    await user.click(screen.getByRole('button', { name: 'More' }));

    // act
    await user.click(screen.getByRole('link', { name: 'Income sources' }));

    // assert
    expect(router.state.location.pathname).toBe('/income-sources');
    expect(screen.getByRole('button', { name: 'More' })).toHaveAttribute('aria-expanded', 'false');
    expect(onSectionChoose).toHaveBeenCalledOnce();
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

test.each([
  { name: 'Home', path: '/', interaction: 'click' },
  { name: 'Transactions', path: '/transactions', interaction: 'click' },
  { name: 'Accounts', path: '/accounts', interaction: 'click' },
  { name: 'Categories', path: '/categories', interaction: 'click' },
  { name: 'Home', path: '/', interaction: 'tap' },
  { name: 'Transactions', path: '/transactions', interaction: 'tap' },
  { name: 'Accounts', path: '/accounts', interaction: 'tap' },
  { name: 'Categories', path: '/categories', interaction: 'tap' },
])(
  'navigates to $name and closes More on the first $interaction',
  async ({ name, path, interaction }) => {
    // arrange
    const user = userEvent.setup();
    const { router } = render(
      <MainNavigation
        menuState="full"
        menuToggleRef={{ current: null }}
        onMenuToggle={() => undefined}
        onSectionChoose={() => undefined}
      />,
      { initialEntries: ['/income-sources'] },
    );
    await user.click(screen.getByRole('button', { name: 'More' }));

    // act
    const sectionLabel = screen.getByText(name);
    if (interaction === 'tap') {
      await user.pointer({ keys: '[TouchA]', target: sectionLabel });
    } else {
      await user.click(sectionLabel);
    }

    // assert
    expect(router.state.location.pathname).toBe(path);
    expect(screen.getByRole('button', { name: 'More' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: 'More' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Income sources' })).not.toHaveAttribute(
      'aria-current',
    );
  },
);

test('only dismisses More when Add transaction is tapped and opens the form on the next tap', async () => {
  // arrange
  const user = userEvent.setup();
  const { router } = render(
    <MainNavigation
      menuState="full"
      menuToggleRef={{ current: null }}
      onMenuToggle={() => undefined}
      onSectionChoose={() => undefined}
    />,
  );
  await user.click(screen.getByRole('button', { name: 'More' }));

  // act
  await user.pointer({
    keys: '[TouchA]',
    target: screen.getByRole('button', { name: 'Add transaction' }),
  });

  // assert
  expect(screen.getByRole('button', { name: 'More' })).toHaveAttribute('aria-expanded', 'false');
  expect(router.state.location.search).toBe('');
  await user.pointer({
    keys: '[TouchA]',
    target: screen.getByRole('button', { name: 'Add transaction' }),
  });
  expect(router.state.location.search).toBe('?new_transaction=EXPENSE');
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
