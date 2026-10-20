import { useQuery } from '@tanstack/react-query';

import type { components } from '@/lib/api-schema';

import { userQueries } from '../api/user-queries';
import { UserInitials } from './user-initials';
import styles from './user-summary.module.css';

const PROVIDER_NAMES = {
  TELEGRAM: 'Telegram',
  GOOGLE: 'Google',
} as const satisfies Record<components['schemas']['ProviderType'], string>;

export function UserSummary() {
  const { data: user } = useQuery(userQueries.me());
  if (user === undefined) {
    return null;
  }

  return (
    <div className={styles['userSummary']}>
      <span className={styles['avatar']} aria-hidden="true">
        <UserInitials />
      </span>
      <div className={styles['identity']}>
        <span className={styles['name']}>{user.username}</span>
        <span className={styles['provider']}>
          Signed in with {PROVIDER_NAMES[user.registration_provider]}
        </span>
      </div>
    </div>
  );
}
