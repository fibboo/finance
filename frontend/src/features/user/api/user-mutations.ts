import { mutationOptions } from '@tanstack/react-query';

import { apiClient, readData } from '@/lib/api-client';
import { ApiError } from '@/lib/api-error';
import type { components } from '@/lib/api-schema';

import { userQueries } from './user-queries';

type BaseCurrencySet = components['schemas']['BaseCurrencySet'];
type UsernameSet = components['schemas']['UsernameSet'];
type User = components['schemas']['User'];

async function putBaseCurrency(body: BaseCurrencySet): Promise<User> {
  const user = readData(await apiClient.PUT('/user/me/base_currency', { body }));
  return user;
}

async function putUsername(body: UsernameSet): Promise<User> {
  try {
    const user = readData(await apiClient.PUT('/user/me/username', { body }));
    return user;
  } catch (error) {
    if (error instanceof ApiError && error.error_code === 'USERNAME_ALREADY_TAKEN') {
      throw new ApiError({
        status: error.status,
        message: error.message,
        error_code: error.error_code,
        fieldErrors: [{ field: 'username', message: error.message }],
      });
    }

    throw error;
  }
}

export const userMutations = {
  setBaseCurrency() {
    return mutationOptions({
      mutationFn: putBaseCurrency,
      onSuccess: (_user, _body, _onMutateResult, { client }) =>
        client.invalidateQueries({ queryKey: userQueries.me().queryKey }),
    });
  },
  setUsername() {
    return mutationOptions({
      mutationFn: putUsername,
      onSuccess: (_user, _body, _onMutateResult, { client }) =>
        client.invalidateQueries({ queryKey: userQueries.me().queryKey }),
    });
  },
};
