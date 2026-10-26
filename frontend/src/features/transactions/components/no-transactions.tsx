import styles from './no-transactions.module.css';

export function NoTransactions() {
  return (
    <p className={styles['noTransactions']}>
      <span className={styles['title']}>Nothing here yet</span>
      <span className={styles['text']}>Your income and expenses will show up here.</span>
    </p>
  );
}
