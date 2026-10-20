import { mutationOptions } from '@tanstack/react-query';

import { apiClient, readData } from '@/lib/api-client';
import type { components } from '@/lib/api-schema';

import { userQueries } from './user-queries';

type BaseCurrencySet = components['schemas']['BaseCurrencySet'];
type User = components['schemas']['User'];

async function putBaseCurrency(body: BaseCurrencySet): Promise<User> {
  const user = readData(await apiClient.PUT('/user/me/base_currency', { body }));
  return user;
}

export const userMutations = {
  setBaseCurrency() {
    return mutationOptions({
      mutationFn: putBaseCurrency,
      onSuccess: (_user, _body, _onMutateResult, { client }) =>
        client.invalidateQueries({ queryKey: userQueries.me().queryKey }),
    });
  },
};
