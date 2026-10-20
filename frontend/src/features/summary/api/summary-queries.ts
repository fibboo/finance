import { queryOptions } from '@tanstack/react-query';

import { apiClient, readData } from '@/lib/api-client';
import type { components } from '@/lib/api-schema';

type Summary = components['schemas']['Summary'];

async function fetchCurrentSummary(): Promise<Summary> {
  const summary = readData(await apiClient.GET('/accounting/summary'));
  return summary;
}

export const summaryQueries = {
  current() {
    return queryOptions({ queryKey: ['summary', 'current'], queryFn: fetchCurrentSummary });
  },
};
