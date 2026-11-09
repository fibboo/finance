import styles from './load-error.module.css';

type LoadErrorProps = Readonly<{ message: string; onRetry: () => void }>;

export function LoadError({ message, onRetry }: LoadErrorProps) {
  return (
    <p className={styles['loadError']}>
      {message}
      <button type="button" className={styles['retry']} onClick={onRetry}>
        Try again
      </button>
    </p>
  );
}
