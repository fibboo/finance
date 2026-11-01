import { useMutation, useQuery } from '@tanstack/react-query';
import { useId } from 'react';
import { Link, useNavigate } from 'react-router';

import type { components } from '@/lib/api-schema';
import { LOCALE } from '@/lib/format-money';

import { userMutations } from '../api/user-mutations';
import { userQueries } from '../api/user-queries';
import { formatInitials } from './format-initials';
import styles from './merge-offer.module.css';

type MergeOfferProps = Readonly<{
  provider: components['schemas']['ProviderType'];
  providerTypes: readonly components['schemas']['DictionaryItem'][];
  mergeOffer: components['schemas']['MergeOffer'];
}>;

const PROVIDER_LIST_FORMAT = new Intl.ListFormat(LOCALE, { type: 'disjunction' });
const COUNT_FORMAT = new Intl.NumberFormat(LOCALE);

export function MergeOffer({ provider, providerTypes, mergeOffer }: MergeOfferProps) {
  const headingId = useId();
  const navigate = useNavigate();
  const { data: user } = useQuery(userQueries.me());
  const mergeMutation = useMutation(userMutations.merge());
  const signInProviders: readonly string[] = [
    provider,
    ...(user?.external_users.map((externalUser) => externalUser.provider) ?? []),
  ];
  const signInLabels = providerTypes
    .filter((providerType) => signInProviders.includes(providerType.key))
    .map((providerType) => providerType.label);
  const providerLabel = providerTypes.find((providerType) => providerType.key === provider)?.label;

  return (
    <section className={styles['mergeOffer']} aria-labelledby={headingId}>
      <div className={styles['intro']}>
        <h2 id={headingId} className={styles['title']}>
          This {providerLabel} sign-in belongs to another account
        </h2>
        <p className={styles['text']}>
          Merge it into yours to keep everything in one place and sign in with{' '}
          {PROVIDER_LIST_FORMAT.format(signInLabels)}.
        </p>
      </div>
      <div className={styles['account']}>
        <div className={styles['identity']}>
          <span className={styles['avatar']} aria-hidden="true">
            {formatInitials(mergeOffer.username)}
          </span>
          <div className={styles['names']}>
            <span className={styles['username']}>{mergeOffer.username}</span>
            {mergeOffer.base_currency !== null && (
              <span className={styles['currency']}>Main currency {mergeOffer.base_currency}</span>
            )}
          </div>
        </div>
        <dl className={styles['counts']}>
          <div className={styles['count']}>
            <dt className={styles['countLabel']}>Accounts</dt>
            <dd className={styles['countValue']}>
              {COUNT_FORMAT.format(mergeOffer.accounts_count)}
            </dd>
          </div>
          <div className={styles['count']}>
            <dt className={styles['countLabel']}>Transactions</dt>
            <dd className={styles['countValue']}>
              {COUNT_FORMAT.format(mergeOffer.transactions_count)}
            </dd>
          </div>
        </dl>
      </div>
      <ul className={styles['effects']}>
        <li>Its accounts, locations and transactions move to you.</li>
        <li>Categories, income sources and locations with the same name become one.</li>
        <li>A money account whose name you already use gets a number.</li>
        <li>The account {mergeOffer.username} is deleted. This can’t be undone.</li>
      </ul>
      <div className={styles['actions']}>
        <Link to="/" className={styles['notNow']}>
          Not now
        </Link>
        <button
          type="button"
          className={styles['merge']}
          disabled={mergeMutation.isPending || mergeMutation.isSuccess}
          onClick={() => {
            mergeMutation.mutate(
              { merge_code: mergeOffer.merge_code },
              {
                onSuccess: () => {
                  void navigate('/', { replace: true });
                },
              },
            );
          }}
        >
          Merge
        </button>
      </div>
    </section>
  );
}
