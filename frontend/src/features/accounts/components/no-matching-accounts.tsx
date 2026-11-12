import styles from './no-matching-accounts.module.css';

const SEARCH_ICON_PATH = 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14m9 16-3.5-3.5';

type NoMatchingAccountsProps = Readonly<{
  entityNames: 'accounts' | 'categories';
  onClear: () => void;
}>;

export function NoMatchingAccounts({ entityNames, onClear }: NoMatchingAccountsProps) {
  return (
    <div className={styles['noMatchingAccounts']}>
      <span className={styles['iconBox']} aria-hidden="true">
        <svg className={styles['icon']} viewBox="0 0 24 24">
          <path d={SEARCH_ICON_PATH} />
        </svg>
      </span>
      <p className={styles['title']}>No {entityNames} match this search</p>
      <p className={styles['text']}>Try another name or description.</p>
      <button type="button" className={styles['clear']} onClick={onClear}>
        Clear search
      </button>
    </div>
  );
}
