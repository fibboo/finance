import styles from './boot-screen.module.css';

export function BootScreen() {
  return (
    <div role="status" aria-label="Loading" className={styles['bootScreen']}>
      <span className={styles['logo']}>
        <span className={styles['mark']} aria-hidden="true" />
        finance
      </span>
      <span className={styles['track']}>
        <span className={styles['progress']} />
      </span>
    </div>
  );
}
