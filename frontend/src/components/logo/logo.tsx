import styles from './logo.module.css';

export function Logo() {
  return (
    <span className={styles['logo']}>
      <span className={styles['mark']} aria-hidden="true" />
      finance
    </span>
  );
}
