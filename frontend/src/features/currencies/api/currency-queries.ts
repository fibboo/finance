import { queryOptions } from '@tanstack/react-query';

import { apiClient, readData } from '@/lib/api-client';
import type { components } from '@/lib/api-schema';

type DictionaryItem = components['schemas']['DictionaryItem'];

async function fetchCurrencies(): Promise<DictionaryItem[]> {
  const currencies = readData(await apiClient.GET('/accounting/currencies'));
  return currencies;
}

export const currencyQueries = {
  recentUse() {
    return queryOptions({
      queryKey: ['currencies', 'recent_use'],
      queryFn: fetchCurrencies,
      refetchInterval: false,
    });
  },
};
