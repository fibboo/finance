import { useMutation } from '@tanstack/react-query';

import { ApiError } from '@/lib/api-error';
import type { components } from '@/lib/api-schema';

import { accountMutations } from '../api/account-mutations';

type AccountCreateRequest = components['schemas']['AccountCreateRequest'];
type AccountFieldError = Readonly<{
  field: 'name' | 'description' | 'root.server';
  message: string;
}>;

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
        if (error instanceof ApiError) {
          error.fieldErrors.forEach((fieldError) => {
            onFieldError({
              field:
                fieldError.field === 'name' || fieldError.field === 'description'
                  ? fieldError.field
                  : 'root.server',
              message: fieldError.message,
            });
          });
        }
      },
    });
  }

  const accountCreate = { isPending: mutation.isPending, create };
  return accountCreate;
}
