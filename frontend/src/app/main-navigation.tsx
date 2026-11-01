import { NavLink, useSearchParams } from 'react-router';

import {
  DEFAULT_ENTRY_TRANSACTION_TYPE,
  writeNewTransactionType,
} from '@/features/transactions/api/new-transaction';

import styles from './main-navigation.module.css';

const HOME_ICON_PATH = 'M4 11 12 4l8 7v9h-5v-6H9v6H4z';
const TRANSACTIONS_ICON_PATH = 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01';
const ADD_ICON_PATH = 'M12 5v14M5 12h14';
const SOON_SECTIONS = [
  {
    name: 'Accounts',
    iconPath:
      'M6 6h12a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3M3 10h18M16 14.5h2',
  },
  {
    name: 'Categories',
    iconPath: 'M3 12V4h8l10 10-8 8zM7.5 7.2a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6',
  },
] as const;

export function MainNavigation() {
  const [searchParams, setSearchParams] = useSearchParams();
  return (
    <nav aria-label="Main" className={styles['mainNavigation']}>
      <button
        type="button"
        className={styles['addTransaction']}
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
      {SOON_SECTIONS.map((section) => (
        <button key={section.name} type="button" className={styles['section']} disabled>
          <svg className={styles['icon']} aria-hidden="true" viewBox="0 0 24 24">
            <path d={section.iconPath} />
          </svg>
          <span className={styles['label']}>{section.name}</span>{' '}
          <span className={`visually-hidden ${styles['soon'] ?? ''}`}>Soon</span>
        </button>
      ))}
    </nav>
  );
}
