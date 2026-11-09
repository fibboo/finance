import { mutationOptions, type QueryKey } from '@tanstack/react-query';

import { apiClient, readData } from '@/lib/api-client';
import { ApiError } from '@/lib/api-error';
import type { components } from '@/lib/api-schema';

import { accountQueries } from './account-queries';

type Account = components['schemas']['Account'];
type AccountCreateRequest = components['schemas']['AccountCreateRequest'];
type AccountUpdate = components['schemas']['AccountUpdate'];

function readNameError(error: unknown): unknown {
  const nameError =
    error instanceof ApiError && error.error_code === 'NAME_ALREADY_EXISTS'
      ? new ApiError({
          status: error.status,
          message: error.message,
          error_code: error.error_code,
          fieldErrors: [{ field: 'name', message: error.message }],
        })
      : error;
  return nameError;
}

async function postAccount(body: Readonly<AccountCreateRequest>): Promise<Account> {
  try {
    const account = readData(await apiClient.POST('/accounting/accounts', { body }));
    return account;
  } catch (error) {
    throw readNameError(error);
  }
}

async function putAccount({
  account_id,
  ...body
}: Readonly<AccountUpdate & { account_id: string }>): Promise<Account> {
  try {
    const account = readData(
      await apiClient.PUT('/accounting/accounts/{account_id}', {
        params: { path: { account_id } },
        body,
      }),
    );
    return account;
  } catch (error) {
    throw readNameError(error);
  }
}

export const accountMutations = {
  create() {
    return mutationOptions({
      mutationFn: postAccount,
      onSuccess: (_account, _body, _onMutateResult, { client }) =>
        client.invalidateQueries({ queryKey: accountQueries.all().queryKey }),
    });
  },
  update(relatedQueryKeys: readonly QueryKey[]) {
    return mutationOptions({
      mutationFn: putAccount,
      onSuccess: (_account, _body, _onMutateResult, { client }) =>
        Promise.all(
          [accountQueries.all().queryKey, ...relatedQueryKeys].map((queryKey) =>
            client.invalidateQueries({ queryKey }),
          ),
        ),
    });
  },
};
