import { useMutation, useQuery } from '@tanstack/react-query';

import { readFreeAccountColors } from '@/lib/account-colors';
import { ApiError } from '@/lib/api-error';
import type { components } from '@/lib/api-schema';

import { accountMutations } from '../api/account-mutations';
import { ACCOUNT_PAGE_SIZE, accountQueries } from '../api/account-queries';

type AccountKind = components['schemas']['AccountKind'];
type AccountCreateRequest = components['schemas']['AccountCreateRequest'];
type AccountFieldError = Readonly<{
  field: 'name' | 'description' | 'root.server';
  message: string;
}>;

export function useAccountCreate({
  colorGroup,
  pickedColor,
  onCreated,
  onFieldError,
}: Readonly<{
  colorGroup: readonly AccountKind[];
  pickedColor: string;
  onCreated: (id: string) => void;
  onFieldError: (fieldError: AccountFieldError) => void;
}>) {
  const { data: groupAccounts } = useQuery(
    accountQueries.list({ kinds: [...colorGroup], size: ACCOUNT_PAGE_SIZE, order: 'recent_use' }),
  );
  const mutation = useMutation(accountMutations.create());
  const freeColors =
    groupAccounts === undefined ? undefined : readFreeAccountColors(groupAccounts.items);
  const color =
    freeColors?.find((freeColor) => freeColor.value === pickedColor)?.value ??
    freeColors?.[0]?.value;

  function create(account: Readonly<Omit<AccountCreateRequest, 'color'>>) {
    if (color === undefined) {
      throw new Error('An account needs a free color.');
    }

    mutation.mutate(
      { ...account, color },
      {
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
      },
    );
  }

  const accountCreate = {
    freeColors,
    color,
    isSubmitDisabled: color === undefined || mutation.isPending,
    create,
  };
  return accountCreate;
}
