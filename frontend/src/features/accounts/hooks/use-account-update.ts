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
  const mutation = useMutation(accountMutations.update(relatedQueryKeys));

  function update(account: Readonly<AccountUpdate & { account_id: string }>) {
    mutation.mutate(account, {
      onSuccess: () => {
        onSaved();
      },
      onError: (error) => {
        readAccountFieldErrors(error).forEach(onFieldError);
      },
    });
  }

  const accountUpdate = { isPending: mutation.isPending, update };
  return accountUpdate;
}
