import { type QueryKey, useMutation } from '@tanstack/react-query';

import type { components } from '@/lib/api-schema';

import { type AccountFieldError, readAccountFieldErrors } from '../api/account-field-errors';
import { accountMutations } from '../api/account-mutations';

type AccountUpdate = components['schemas']['AccountUpdate'];

export function useAccountUpdate({
  relatedQueryKeys,
  onSaved,
  onFieldError,
}: Readonly<{
  relatedQueryKeys: readonly QueryKey[];
  onSaved: () => void;
  onFieldError: (fieldError: AccountFieldError) => void;
}>) {
  const updateOptions = accountMutations.update(relatedQueryKeys);
  const mutation = useMutation({
    ...updateOptions,
    onSuccess: async (account, body, onMutateResult, context) => {
      await updateOptions.onSuccess?.(account, body, onMutateResult, context);
      onSaved();
    },
  });

  function update(account: Readonly<AccountUpdate & { account_id: string }>) {
    mutation.mutate(account, {
      onError: (error) => {
        readAccountFieldErrors(error).forEach(onFieldError);
      },
    });
  }

  const accountUpdate = { isPending: mutation.isPending, update };
  return accountUpdate;
}
