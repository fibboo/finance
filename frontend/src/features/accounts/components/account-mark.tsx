import { readAccountColor } from '@/lib/account-colors';

import styles from './account-mark.module.css';

type AccountMarkProps = Readonly<{ account: Readonly<{ name: string; color: string | null }> }>;

export function AccountMark({ account }: AccountMarkProps) {
  return (
    <span
      className={styles['accountMark']}
      style={{ color: readAccountColor(account) }}
      aria-hidden="true"
    >
      {account.name.slice(0, 1).toUpperCase()}
    </span>
  );
}
