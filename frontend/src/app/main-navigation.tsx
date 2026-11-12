import { matchPath, NavLink, useLocation, useSearchParams } from 'react-router';

import {
  DEFAULT_ENTRY_TRANSACTION_TYPE,
  writeNewTransactionType,
} from '@/features/transactions/api/new-transaction';

import styles from './main-navigation.module.css';
import { MoreMenu } from './more-menu';

const HOME_ICON_PATH = 'M4 11 12 4l8 7v9h-5v-6H9v6H4z';
const TRANSACTIONS_ICON_PATH = 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01';
const ACCOUNTS_ICON_PATH =
  'M6 6h12a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3M3 10h18M16 14.5h2';
const CATEGORIES_ICON_PATH = 'M3 12V4h8l10 10-8 8zM7.5 7.2a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6';
const ADD_ICON_PATH = 'M12 5v14M5 12h14';
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

export function MainNavigation() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { pathname } = useLocation();
  const isHome = matchPath('/', pathname) !== null;
  const isMoreSectionOpen = MORE_SECTIONS.some(
    (section) => matchPath({ path: section.path, end: false }, pathname) !== null,
  );

  return (
    <nav aria-label="Main" className={styles['mainNavigation']}>
      <button
        type="button"
        className={isHome ? styles['addTransaction'] : styles['addTransactionOffHome']}
        onClick={() => {
          setSearchParams(
            writeNewTransactionType({
              searchParams,
              transactionType: DEFAULT_ENTRY_TRANSACTION_TYPE,
            }),
            { preventScrollReset: true },
          );
        }}
      >
        <svg className={styles['icon']} aria-hidden="true" viewBox="0 0 24 24">
          <path d={ADD_ICON_PATH} />
        </svg>
        <span className={`visually-hidden ${styles['addLabel'] ?? ''}`}>Add transaction</span>
      </button>
      <NavLink to="/" end className={styles['section'] ?? ''}>
        <svg className={styles['icon']} aria-hidden="true" viewBox="0 0 24 24">
          <path d={HOME_ICON_PATH} />
        </svg>
        <span className={styles['label']}>Home</span>
      </NavLink>
      <NavLink to="/transactions" className={styles['section'] ?? ''}>
        <svg className={styles['icon']} aria-hidden="true" viewBox="0 0 24 24">
          <path d={TRANSACTIONS_ICON_PATH} />
        </svg>
        <span className={styles['label']}>Transactions</span>
      </NavLink>
      <NavLink to="/accounts" className={styles['section'] ?? ''}>
        <svg className={styles['icon']} aria-hidden="true" viewBox="0 0 24 24">
          <path d={ACCOUNTS_ICON_PATH} />
        </svg>
        <span className={styles['label']}>Accounts</span>
      </NavLink>
      <button type="button" className={styles['section']} disabled>
        <svg className={styles['icon']} aria-hidden="true" viewBox="0 0 24 24">
          <path d={CATEGORIES_ICON_PATH} />
        </svg>
        <span className={styles['label']}>Categories</span>{' '}
        <span className={`visually-hidden ${styles['soon'] ?? ''}`}>Soon</span>
      </button>
      <MoreMenu isCurrent={isMoreSectionOpen}>
        {MORE_SECTIONS.map((section) => (
          <button key={section.name} type="button" className={styles['moreSection']} disabled>
            <svg className={styles['icon']} aria-hidden="true" viewBox="0 0 24 24">
              <path d={section.iconPath} />
            </svg>
            <span className={styles['label']}>{section.name}</span>{' '}
            <span className={styles['soon']}>Soon</span>
          </button>
        ))}
      </MoreMenu>
    </nav>
  );
}
