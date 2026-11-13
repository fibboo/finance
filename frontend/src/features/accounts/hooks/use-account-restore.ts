import { type QueryKey, useMutation } from '@tanstack/react-query';

import { ApiError } from '@/lib/api-error';
import type { components } from '@/lib/api-schema';

import { type AccountFieldError, readAccountFieldErrors } from '../api/account-field-errors';
import { accountMutations } from '../api/account-mutations';

type AccountRestoreRequest = components['schemas']['AccountRestoreRequest'];

export function useAccountRestore({
  relatedQueryKeys,
  onRestored,
  onNameTaken,
  onFieldError,
}: Readonly<{
  relatedQueryKeys: readonly QueryKey[];
  onRestored: () => void;
  onNameTaken: () => void;
  onFieldError: (fieldError: AccountFieldError) => void;
}>) {
  const restoreOptions = accountMutations.restore(relatedQueryKeys);
  const mutation = useMutation({
    ...restoreOptions,
    onSuccess: async (account, restore, onMutateResult, context) => {
      await restoreOptions.onSuccess?.(account, restore, onMutateResult, context);
      onRestored();
    },
  });

  function restore(account: Readonly<AccountRestoreRequest & { account_id: string }>) {
    mutation.mutate(account, {
      onError: (error) => {
        if (error instanceof ApiError && error.error_code === 'NAME_ALREADY_EXISTS') {
          onNameTaken();
        } else {
          readAccountFieldErrors(error).forEach(onFieldError);
        }
      },
    });
  }

  const accountRestore = { isPending: mutation.isPending, restore };
  return accountRestore;
}
