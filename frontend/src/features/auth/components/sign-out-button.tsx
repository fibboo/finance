import { useMutation } from '@tanstack/react-query';

import { signOut } from '../api/session';
import styles from './sign-out-button.module.css';

type SignOutButtonProps = Readonly<{
  appearance?: 'outlined' | 'text';
}>;

export function SignOutButton({ appearance = 'outlined' }: SignOutButtonProps) {
  const signOutMutation = useMutation({ mutationFn: signOut });
  return (
    <button
      type="button"
      className={`${styles['signOutButton'] ?? ''} ${appearance === 'text' ? (styles['text'] ?? '') : ''}`}
      disabled={signOutMutation.isPending}
      onClick={() => {
        signOutMutation.mutate();
      }}
    >
      Sign out
    </button>
  );
}
