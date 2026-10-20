import styles from './auth-callback-page.module.css';

export function AuthCallbackPage() {
  return (
    <main className={styles['authCallbackPage']}>
      <p role="status" className={styles['text']}>
        Signing in…
      </p>
    </main>
  );
}
