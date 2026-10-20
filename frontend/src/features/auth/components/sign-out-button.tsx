import { useMutation, useQueryClient } from '@tanstack/react-query';

import { signOut } from '../api/session';
import styles from './sign-out-button.module.css';

export function SignOutButton() {
  const queryClient = useQueryClient();
  const signOutMutation = useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      queryClient.removeQueries();
    },
  });
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
