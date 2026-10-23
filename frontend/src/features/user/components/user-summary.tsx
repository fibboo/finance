import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import type { components } from '@/lib/api-schema';

import { userQueries } from '../api/user-queries';
import { UserInitials } from './user-initials';
import styles from './user-summary.module.css';
import { UsernameForm } from './username-form';

type UserSummaryProps = Readonly<{
  providerTypes: readonly components['schemas']['DictionaryItem'][];
}>;

type UsernameEditStatus = 'idle' | 'editing' | 'closed';

export function UserSummary({ providerTypes }: UserSummaryProps) {
  const [editStatus, setEditStatus] = useState<UsernameEditStatus>('idle');
  const { data: user } = useQuery(userQueries.me());
  if (user === undefined) {
    return null;
  }

  if (editStatus === 'editing') {
    return (
      <UsernameForm
        username={user.username}
        onClose={() => {
          setEditStatus('closed');
        }}
      />
    );
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
      <button
        ref={(button) => {
          if (editStatus === 'closed') {
            button?.focus();
          }
        }}
        type="button"
        className={styles['change']}
        aria-label="Change username"
        onClick={() => {
          setEditStatus('editing');
        }}
      >
        <svg className={styles['changeIcon']} aria-hidden="true" viewBox="0 0 24 24">
          <path d="M4 20h4L19 9l-4-4L4 16v4Z" />
          <path d="m13.5 6.5 4 4" />
        </svg>
      </button>
    </div>
  );
}
