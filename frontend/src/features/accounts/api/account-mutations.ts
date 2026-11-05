import { mutationOptions } from '@tanstack/react-query';

import { apiClient, readData } from '@/lib/api-client';
import { ApiError } from '@/lib/api-error';
import type { components } from '@/lib/api-schema';

import { accountQueries } from './account-queries';

type Account = components['schemas']['Account'];
type AccountCreateRequest = components['schemas']['AccountCreateRequest'];

async function postAccount(body: Readonly<AccountCreateRequest>): Promise<Account> {
  try {
    const account = readData(await apiClient.POST('/accounting/accounts', { body }));
    return account;
  } catch (error) {
    if (error instanceof ApiError && error.error_code === 'NAME_ALREADY_EXISTS') {
      throw new ApiError({
        status: error.status,
        message: error.message,
        error_code: error.error_code,
        fieldErrors: [{ field: 'name', message: error.message }],
      });
    }

    throw error;
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
};
