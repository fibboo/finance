import styles from './no-matching-transactions.module.css';

const LIST_ICON_PATH = 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01';

type NoMatchingTransactionsProps = Readonly<{ onReset: () => void }>;

export function NoMatchingTransactions({ onReset }: NoMatchingTransactionsProps) {
  return (
    <div className={styles['noMatchingTransactions']}>
      <span className={styles['iconBox']} aria-hidden="true">
        <svg className={styles['icon']} viewBox="0 0 24 24">
          <path d={LIST_ICON_PATH} />
        </svg>
      </span>
      <p className={styles['title']}>Nothing matches these filters</p>
      <p className={styles['text']}>Try fewer filters.</p>
      <button type="button" className={styles['reset']} onClick={onReset}>
        Reset filters
      </button>
    </div>
  );
}
