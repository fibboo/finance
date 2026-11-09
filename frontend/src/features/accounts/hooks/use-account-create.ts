import { useMutation } from '@tanstack/react-query';

import type { components } from '@/lib/api-schema';

import { type AccountFieldError, readAccountFieldErrors } from '../api/account-field-errors';
import { accountMutations } from '../api/account-mutations';

type AccountCreateRequest = components['schemas']['AccountCreateRequest'];

export function useAccountCreate({
  onCreated,
  onFieldError,
}: Readonly<{
  onCreated: (id: string) => void;
  onFieldError: (fieldError: AccountFieldError) => void;
}>) {
  const mutation = useMutation(accountMutations.create());

  function create(account: Readonly<AccountCreateRequest>) {
    mutation.mutate(account, {
      onSuccess: (createdAccount) => {
        onCreated(createdAccount.id);
      },
      onError: (error) => {
        readAccountFieldErrors(error).forEach(onFieldError);
      },
    });
  }

  const accountCreate = { isPending: mutation.isPending, create };
  return accountCreate;
}
