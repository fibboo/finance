import { useQuery } from '@tanstack/react-query';
import { useId } from 'react';
import { Link } from 'react-router';

import type { components } from '@/lib/api-schema';
import { LOCALE } from '@/lib/format-money';

import { userQueries } from '../api/user-queries';
import styles from './merge-refusal.module.css';

type MergeRefusalProps = Readonly<{
  provider: components['schemas']['ProviderType'];
  providerTypes: readonly components['schemas']['DictionaryItem'][];
  mergeOffer: components['schemas']['MergeOffer'];
}>;

const PROVIDER_LIST_FORMAT = new Intl.ListFormat(LOCALE, { type: 'conjunction' });

export function MergeRefusal({ provider, providerTypes, mergeOffer }: MergeRefusalProps) {
  const headingId = useId();
  const { data: user } = useQuery(userQueries.me());
  const linkedProviders: readonly string[] =
    user?.external_users.map((externalUser) => externalUser.provider) ?? [];
  const sharedLabel = PROVIDER_LIST_FORMAT.format(
    providerTypes
      .filter((providerType) => linkedProviders.includes(providerType.key))
      .map((providerType) => providerType.label),
  );
  const providerLabel = providerTypes.find((providerType) => providerType.key === provider)?.label;

  return (
    <section className={styles['mergeRefusal']} aria-labelledby={headingId}>
      <div className={styles['intro']}>
        <span className={styles['icon']} aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7.5v5.5M12 16.5v.01" />
          </svg>
        </span>
        <div className={styles['copy']}>
          <h2 id={headingId} className={styles['title']}>
            {mergeOffer.username} can’t be merged into your account
          </h2>
          <p className={styles['text']}>
            This {providerLabel} sign-in belongs to {mergeOffer.username}, so it isn’t linked.
          </p>
        </div>
      </div>
      {mergeOffer.is_base_currency_mismatch ? (
        <div className={styles['reason']}>
          <dl className={styles['currencies']}>
            <div className={styles['currency']}>
              <dt className={styles['currencyOwner']}>You</dt>
              <dd className={styles['currencyCode']}>{user?.base_currency}</dd>
            </div>
            <div className={styles['currency']}>
              <dt className={styles['currencyOwner']}>{mergeOffer.username}</dt>
              <dd className={styles['currencyCode']}>{mergeOffer.base_currency}</dd>
            </div>
          </dl>
          <p className={styles['reasonText']}>
            Accounts with different main currencies can’t be merged.
          </p>
        </div>
      ) : (
        <div className={styles['reason']}>
          <p className={styles['reasonText']}>
            {mergeOffer.username} also signs in with {sharedLabel}, and one account can have only
            one {sharedLabel} sign-in. Unlink {sharedLabel} from one of the two accounts, then link{' '}
            {providerLabel} again.
          </p>
        </div>
      )}
      <Link to="/" replace className={styles['backHome']}>
        Back to Home
      </Link>
    </section>
  );
}
