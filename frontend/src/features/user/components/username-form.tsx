import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { ApiError } from '@/lib/api-error';

import { userMutations } from '../api/user-mutations';
import { usernameFormSchema } from '../schemas/username-form';
import { UsernameField } from './username-field';
import styles from './username-form.module.css';

type UsernameFormInput = z.input<typeof usernameFormSchema>;
type UsernameFormOutput = z.output<typeof usernameFormSchema>;

type UsernameFormProps = Readonly<{
  username: string;
  onClose: () => void;
}>;

export function UsernameForm({ username, onClose }: UsernameFormProps) {
  const { register, handleSubmit, setError, formState } = useForm<
    UsernameFormInput,
    unknown,
    UsernameFormOutput
  >({ resolver: zodResolver(usernameFormSchema), defaultValues: { username } });
  const setUsername = useMutation(userMutations.setUsername());
  const requestError = formState.errors.root?.['server']?.message;

  return (
    <form
      ref={(form) => {
        const input = form?.elements.namedItem('username');
        if (input instanceof HTMLInputElement) {
          input.focus();
        }
      }}
      className={styles['usernameForm']}
      noValidate
      onSubmit={(event) => {
        void handleSubmit((values) => {
          setUsername.mutate(values, {
            onSuccess: onClose,
            onError: (error) => {
              if (error instanceof ApiError) {
                error.fieldErrors.forEach((fieldError) => {
                  setError(fieldError.field === 'username' ? 'username' : 'root.server', {
                    message: fieldError.message,
                  });
                });
              }
            },
          });
        })(event);
      }}
    >
      <UsernameField
        registration={register('username')}
        error={formState.errors.username?.message}
      />
      {requestError !== undefined && (
        <p className={styles['error']} role="alert">
          {requestError}
        </p>
      )}
      <div className={styles['actions']}>
        <button type="button" className={styles['cancel']} onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className={styles['save']} disabled={setUsername.isPending}>
          Save
        </button>
      </div>
    </form>
  );
}
