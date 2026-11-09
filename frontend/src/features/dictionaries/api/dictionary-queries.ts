import { queryOptions } from '@tanstack/react-query';

import { apiClient, readData } from '@/lib/api-client';
import type { components } from '@/lib/api-schema';

type AccountingDictionaries = components['schemas']['AccountingDictionaries'];
type UserDictionaries = components['schemas']['UserDictionaries'];

async function fetchAccountingDictionaries(): Promise<AccountingDictionaries> {
  const dictionaries = readData(await apiClient.GET('/dictionaries/accounting'));
  return dictionaries;
}

async function fetchUserDictionaries(): Promise<UserDictionaries> {
  const dictionaries = readData(await apiClient.GET('/dictionaries/user'));
  return dictionaries;
}

export const dictionaryQueries = {
  accounting() {
    return queryOptions({
      queryKey: ['dictionaries', 'accounting'],
      queryFn: fetchAccountingDictionaries,
      staleTime: 'static',
      refetchInterval: false,
    });
  },
  user() {
    return queryOptions({
      queryKey: ['dictionaries', 'user'],
      queryFn: fetchUserDictionaries,
      staleTime: 'static',
      refetchInterval: false,
    });
  },
};
