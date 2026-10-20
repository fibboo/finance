import { useQuery } from '@tanstack/react-query';

import type { components } from '@/lib/api-schema';

import { userQueries } from '../api/user-queries';
import { UserInitials } from './user-initials';
import styles from './user-summary.module.css';

type UserSummaryProps = Readonly<{
  providerTypes: readonly components['schemas']['DictionaryItem'][];
}>;

export function UserSummary({ providerTypes }: UserSummaryProps) {
  const { data: user } = useQuery(userQueries.me());
  if (user === undefined) {
    return null;
  }

  const providerLabel = providerTypes.find(
    (providerType) => providerType.key === user.registration_provider,
  )?.label;

  return (
    <div className={styles['userSummary']}>
      <span className={styles['avatar']} aria-hidden="true">
        <UserInitials />
      </span>
      <div className={styles['identity']}>
        <span className={styles['name']}>{user.username}</span>
        <span className={styles['provider']}>Signed in with {providerLabel}</span>
      </div>
    </div>
  );
}
