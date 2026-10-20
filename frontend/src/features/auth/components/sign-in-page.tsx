import { useMutation } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { Navigate, useSearchParams } from 'react-router';

import { buildAuthorizeUrl } from '../api/pkce';
import { readIsSignedIn, subscribeToSession } from '../api/session';
import styles from './sign-in-page.module.css';

export function SignInPage() {
  const isSignedIn = useSyncExternalStore(subscribeToSession, readIsSignedIn);
  const [searchParams] = useSearchParams();
  const signInMutation = useMutation({
    mutationFn: buildAuthorizeUrl,
    onSuccess: (authorizeUrl) => {
      window.location.assign(authorizeUrl);
    },
  });
  if (isSignedIn) {
    return <Navigate to="/" replace />;
  }

  return (
    <main className={styles['signInPage']}>
      <div className={styles['logo']}>
        <span className={styles['logoMark']} aria-hidden="true" />
        finance
      </div>
      <div className={styles['hero']}>
        <h1 className={styles['title']}>
          Every coin
          <br />
          on the record.
        </h1>
        <p className={styles['text']}>
          Accounts, spending and income across currencies, in one quiet place.
        </p>
      </div>
      <div className={styles['actions']}>
        {searchParams.has('error') && (
          <p role="alert" className={styles['error']}>
            Sign-in did not finish. Please try again.
          </p>
        )}
        <button
          type="button"
          className={styles['primaryButton']}
          disabled={signInMutation.isPending}
          onClick={() => {
            signInMutation.mutate('TELEGRAM');
          }}
        >
          <svg
            aria-hidden="true"
            className={styles['icon']}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          >
            <path d="M21 4 3 11l6 2.5L11 20l3.5-4.5L19 19z" />
            <path d="m9 13.5 7-5" />
          </svg>
          Continue with Telegram
        </button>
        <button
          type="button"
          className={styles['secondaryButton']}
          disabled={signInMutation.isPending}
          onClick={() => {
            signInMutation.mutate('GOOGLE');
          }}
        >
          <span aria-hidden="true" className={styles['googleMark']}>
            G
          </span>
          Continue with Google
        </button>
        <p className={styles['note']}>First sign-in creates your account.</p>
      </div>
    </main>
  );
}
