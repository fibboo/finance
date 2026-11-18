import { type RefObject, useRef } from 'react';
import { Link } from 'react-router';

import styles from './main-navigation.module.css';
import { MoreMenu } from './more-menu';
import { isSectionShown, MORE_SECTIONS, SECTIONS } from './sections';
import { type MenuState, readIsMenuCollapsed } from './use-menu-collapse';
import { useOpenNewTransaction } from './use-open-new-transaction';
import { useShownPathname } from './use-shown-pathname';

const ADD_ICON_PATH = 'M12 5v14M5 12h14';
const COLLAPSE_ICON_PATH = 'M11 6l-6 6 6 6M19 6l-6 6 6 6';
const SHOW_ICON_PATH = 'M5 6l6 6-6 6M13 6l6 6-6 6';
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
  const navigationRef = useRef<HTMLElement>(null);
  const isCollapsed = readIsMenuCollapsed(menuState);
  const labelClassName = `${styles['label'] ?? ''} ${isCollapsed ? 'visually-hidden-on-desktop' : ''}`;

  const openNewTransaction = useOpenNewTransaction();
  const { pathname } = useShownPathname();
  const isMoreSectionOpen = MORE_SECTIONS.some((section) => isSectionShown({ section, pathname }));

  return (
    <nav
      ref={navigationRef}
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
        <Link
          key={section.name}
          to={section.path}
          aria-current={isSectionShown({ section, pathname }) ? 'page' : undefined}
          className={styles['section'] ?? ''}
          title={isCollapsed ? section.name : undefined}
          onClick={onSectionChoose}
        >
          <svg className={styles['icon']} aria-hidden="true" viewBox="0 0 24 24">
            <path d={section.iconPath} />
          </svg>
          <span className={labelClassName}>{section.name}</span>
        </Link>
      ))}
      <MoreMenu
        isCurrent={isMoreSectionOpen}
        navigationRef={navigationRef}
        renderSections={(closeMenu) =>
          MORE_SECTIONS.map((section) => (
            <Link
              key={section.name}
              to={section.path}
              aria-current={isSectionShown({ section, pathname }) ? 'page' : undefined}
              className={styles['moreSection'] ?? ''}
              title={isCollapsed ? section.name : undefined}
              onClick={() => {
                closeMenu();
                onSectionChoose();
              }}
            >
              <svg className={styles['icon']} aria-hidden="true" viewBox="0 0 24 24">
                <path d={section.iconPath} />
              </svg>
              <span className={labelClassName}>{section.name}</span>
            </Link>
          ))
        }
      />
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
