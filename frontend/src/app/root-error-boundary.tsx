import { useQueryErrorResetBoundary } from '@tanstack/react-query';
import { useRevalidator } from 'react-router';

import styles from './root-error-boundary.module.css';

export function RootErrorBoundary() {
  const { reset } = useQueryErrorResetBoundary();
  const revalidator = useRevalidator();

  return (
    <main className={styles['rootErrorBoundary']}>
      <h1 className={styles['title']}>Something went wrong</h1>
      <p className={styles['text']}>The page could not be shown.</p>
      <button
        type="button"
        className={styles['retry']}
        onClick={() => {
          reset();
          void revalidator.revalidate();
        }}
      >
        Try again
      </button>
    </main>
  );
}
