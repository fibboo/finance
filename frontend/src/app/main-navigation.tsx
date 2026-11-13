import type { RefObject } from 'react';
import { matchPath, NavLink, useLocation } from 'react-router';

import styles from './main-navigation.module.css';
import { MoreMenu } from './more-menu';
import { type MenuState, readIsMenuCollapsed } from './use-menu-collapse';
import { useOpenNewTransaction } from './use-open-new-transaction';

const HOME_ICON_PATH = 'M4 11 12 4l8 7v9h-5v-6H9v6H4z';
const TRANSACTIONS_ICON_PATH = 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01';
const ACCOUNTS_ICON_PATH =
  'M6 6h12a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3M3 10h18M16 14.5h2';
const CATEGORIES_ICON_PATH = 'M3 12V4h8l10 10-8 8zM7.5 7.2a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6';
const ADD_ICON_PATH = 'M12 5v14M5 12h14';
const COLLAPSE_ICON_PATH = 'M11 6l-6 6 6 6M19 6l-6 6 6 6';
const SHOW_ICON_PATH = 'M5 6l6 6-6 6M13 6l6 6-6 6';
const SECTIONS = [
  { name: 'Home', path: '/', iconPath: HOME_ICON_PATH },
  { name: 'Transactions', path: '/transactions', iconPath: TRANSACTIONS_ICON_PATH },
  { name: 'Accounts', path: '/accounts', iconPath: ACCOUNTS_ICON_PATH },
  { name: 'Categories', path: '/categories', iconPath: CATEGORIES_ICON_PATH },
] as const;
const MORE_SECTIONS = [
  {
    name: 'Locations',
    path: '/locations',
    iconPath:
      'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 7.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4',
  },
  {
    name: 'Income sources',
    path: '/income-sources',
    iconPath: 'M12 4v10M8 10l4 4 4-4M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3',
  },
] as const;
const IS_EXPANDED_BY_MENU_STATE = {
  full: true,
  collapsed: false,
  collapsedByWidth: false,
  openOverPage: true,
} as const satisfies Record<MenuState, boolean>;

type MainNavigationProps = Readonly<{
  menuState: MenuState;
  menuToggleRef: RefObject<HTMLButtonElement | null>;
  onMenuToggle: () => void;
  onSectionChoose: () => void;
}>;

export function MainNavigation({
  menuState,
  menuToggleRef,
  onMenuToggle,
  onSectionChoose,
}: MainNavigationProps) {
  const isCollapsed = readIsMenuCollapsed(menuState);
  const labelClassName = `${styles['label'] ?? ''} ${isCollapsed ? 'visually-hidden-on-desktop' : ''}`;

  const openNewTransaction = useOpenNewTransaction();
  const { pathname } = useLocation();
  const isMoreSectionOpen = MORE_SECTIONS.some(
    (section) => matchPath({ path: section.path, end: false }, pathname) !== null,
  );

  return (
    <nav
      aria-label="Main"
      className={isCollapsed ? styles['collapsedNavigation'] : styles['mainNavigation']}
    >
      <button
        type="button"
        className={styles['addTransaction']}
        title={isCollapsed ? 'Add transaction' : undefined}
        onClick={() => {
          onSectionChoose();
          openNewTransaction();
        }}
      >
        <svg className={styles['icon']} aria-hidden="true" viewBox="0 0 24 24">
          <path d={ADD_ICON_PATH} />
        </svg>
        <span className={`visually-hidden ${isCollapsed ? '' : (styles['addLabel'] ?? '')}`}>
          Add transaction
        </span>
      </button>
      {SECTIONS.map((section) => (
        <NavLink
          key={section.name}
          to={section.path}
          end={section.path === '/'}
          className={styles['section'] ?? ''}
          title={isCollapsed ? section.name : undefined}
          onClick={onSectionChoose}
        >
          <svg className={styles['icon']} aria-hidden="true" viewBox="0 0 24 24">
            <path d={section.iconPath} />
          </svg>
          <span className={labelClassName}>{section.name}</span>
        </NavLink>
      ))}
      <MoreMenu isCurrent={isMoreSectionOpen}>
        {MORE_SECTIONS.map((section) => (
          <button
            key={section.name}
            type="button"
            className={styles['moreSection']}
            title={isCollapsed ? section.name : undefined}
            disabled
          >
            <svg className={styles['icon']} aria-hidden="true" viewBox="0 0 24 24">
              <path d={section.iconPath} />
            </svg>
            <span className={labelClassName}>{section.name}</span>{' '}
            <span
              className={`${styles['soon'] ?? ''} ${isCollapsed ? 'visually-hidden-on-desktop' : ''}`}
            >
              Soon
            </span>
          </button>
        ))}
      </MoreMenu>
      <button
        ref={menuToggleRef}
        type="button"
        className={styles['menuToggle']}
        aria-expanded={IS_EXPANDED_BY_MENU_STATE[menuState]}
        title={isCollapsed ? 'Show the full menu' : undefined}
        onClick={onMenuToggle}
      >
        <svg className={styles['icon']} aria-hidden="true" viewBox="0 0 24 24">
          <path d={isCollapsed ? SHOW_ICON_PATH : COLLAPSE_ICON_PATH} />
        </svg>
        <span className={labelClassName}>{isCollapsed ? 'Show the full menu' : 'Collapse'}</span>
      </button>
    </nav>
  );
}
