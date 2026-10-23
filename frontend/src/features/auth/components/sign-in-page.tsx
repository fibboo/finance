import { useMutation } from '@tanstack/react-query';
import { type ReactNode, useSyncExternalStore } from 'react';
import { Navigate, useSearchParams } from 'react-router';

import { Logo } from '@/components/logo/logo';
import { Skeleton } from '@/components/skeleton/skeleton';
import { listSkeletonKeys } from '@/components/skeleton/skeleton-keys';
import type { components } from '@/lib/api-schema';

import { buildAuthorizeUrl } from '../api/pkce';
import { readIsSignedIn, subscribeToSession } from '../api/session';
import styles from './sign-in-page.module.css';

type ProviderPresentation = Readonly<{
  className: string | undefined;
  icon: ReactNode;
}>;

type SignInPageProps = Readonly<{
  providerTypes: readonly components['schemas']['DictionaryItem'][] | undefined;
}>;

const SKELETON_PROVIDER_COUNT = 2;

const providerPresentations: Record<string, ProviderPresentation> = {
  TELEGRAM: {
    className: styles['primaryButton'],
    icon: (
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
    ),
  },
  GOOGLE: {
    className: styles['secondaryButton'],
    icon: (
      <span aria-hidden="true" className={styles['googleMark']}>
        G
      </span>
    ),
  },
};

export function SignInPage({ providerTypes }: SignInPageProps) {
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
      <div className={styles['copy']}>
        <Logo />
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
      </div>
      <div className={styles['actions']} aria-busy={providerTypes === undefined}>
        {searchParams.has('error') && (
          <p role="alert" className={styles['error']}>
            Sign-in did not finish. Please try again.
          </p>
        )}
        {providerTypes === undefined &&
          listSkeletonKeys(SKELETON_PROVIDER_COUNT).map((key) => (
            <Skeleton key={key} className={styles['buttonSkeleton']} />
          ))}
        {providerTypes?.map((providerType) => {
          const presentation = providerPresentations[providerType.key];
          return (
            <button
              key={providerType.key}
              type="button"
              className={presentation?.className ?? styles['secondaryButton']}
              disabled={signInMutation.isPending}
              onClick={() => {
                signInMutation.mutate(providerType.key);
              }}
            >
              {presentation?.icon}
              Continue with {providerType.label}
            </button>
          );
        })}
        <p className={styles['note']}>First sign-in creates your account.</p>
      </div>
    </main>
  );
}
