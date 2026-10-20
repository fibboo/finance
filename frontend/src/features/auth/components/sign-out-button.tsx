import { useMutation } from '@tanstack/react-query';

import { signOut } from '../api/session';
import styles from './sign-out-button.module.css';

export function SignOutButton() {
  const signOutMutation = useMutation({ mutationFn: signOut });
  return (
    <button
      type="button"
      className={styles['signOutButton']}
      disabled={signOutMutation.isPending}
      onClick={() => {
        signOutMutation.mutate();
      }}
    >
      Sign out
    </button>
  );
}
