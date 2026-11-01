import { useMutation, useQuery } from '@tanstack/react-query';
import { useId } from 'react';

import { type components, providerTypeValues } from '@/lib/api-schema';

import { userMutations } from '../api/user-mutations';
import { userQueries } from '../api/user-queries';
import styles from './linked-providers.module.css';

type ProviderType = components['schemas']['ProviderType'];

type LinkedProvidersProps = Readonly<{
  providerTypes: readonly components['schemas']['DictionaryItem'][];
  startLink: (provider: ProviderType) => Promise<string>;
}>;

export function LinkedProviders({ providerTypes, startLink }: LinkedProvidersProps) {
  const headingId = useId();
  const { data: user } = useQuery(userQueries.me());
  const unlinkMutation = useMutation(userMutations.unlinkProvider());
  const linkMutation = useMutation({
    mutationFn: startLink,
    onSuccess: (authorizationUrl) => {
      window.location.assign(authorizationUrl);
    },
  });
  if (user === undefined) {
    return null;
  }

  const linkedProviders = user.external_users.map((externalUser) => externalUser.provider);
  const isOnlyOneLinked = linkedProviders.length === 1;
  const isPending = unlinkMutation.isPending || linkMutation.isPending;

  return (
    <section className={styles['linkedProviders']} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles['heading']}>
        Sign-in methods
      </h2>
      <ul className={styles['list']}>
        {providerTypes.map((providerType) => {
          const provider = providerTypeValues.find((value) => value === providerType.key);
          if (provider === undefined) {
            return null;
          }

          const isLinked = linkedProviders.includes(provider);
          return (
            <li key={provider} className={styles['provider']}>
              <span className={styles['mark']} aria-hidden="true">
                {providerType.label.slice(0, 1)}
              </span>
              <div className={styles['identity']}>
                <span className={styles['label']}>{providerType.label}</span>
                <span className={isLinked ? styles['linked'] : styles['status']}>
                  {isLinked ? 'Linked' : 'Not linked'}
                </span>
              </div>
              {isLinked ? (
                <button
                  type="button"
                  className={styles['unlink']}
                  aria-label={`Unlink ${providerType.label}`}
                  disabled={isPending || isOnlyOneLinked}
                  onClick={() => {
                    unlinkMutation.mutate(provider);
                  }}
                >
                  Unlink
                </button>
              ) : (
                <button
                  type="button"
                  className={styles['link']}
                  aria-label={`Link ${providerType.label}`}
                  disabled={isPending}
                  onClick={() => {
                    linkMutation.mutate(provider);
                  }}
                >
                  Link
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {isOnlyOneLinked && (
        <p className={styles['note']}>Link another method before you unlink the only one.</p>
      )}
    </section>
  );
}
