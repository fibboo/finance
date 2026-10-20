import { queryOptions } from '@tanstack/react-query';

import { apiClient, readData } from '@/lib/api-client';
import type { components } from '@/lib/api-schema';

type UserDictionaries = components['schemas']['UserDictionaries'];

async function fetchUserDictionaries(): Promise<UserDictionaries> {
  const dictionaries = readData(await apiClient.GET('/dictionaries/user'));
  return dictionaries;
}

export const dictionaryQueries = {
  user() {
    return queryOptions({
      queryKey: ['dictionaries', 'user'],
      queryFn: fetchUserDictionaries,
      staleTime: Infinity,
    });
  },
};
