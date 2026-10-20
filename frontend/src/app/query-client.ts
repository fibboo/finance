import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { showErrorNotification } from '@/components/error-notification/error-notification-store';

const STALE_TIME_MS = 60_000;
const MAX_RETRIES = 3;
const clientErrorSchema = z.object({ status: z.number().int().min(400).max(499) });

function shouldRetry(failureCount: number, error: unknown): boolean {
  const isClientError = clientErrorSchema.safeParse(error).success;
  const shouldRetryError = !isClientError && failureCount < MAX_RETRIES;

  return shouldRetryError;
}

export function createQueryClient(): QueryClient {
  const queryClient = new QueryClient({
    queryCache: new QueryCache({ onError: showErrorNotification }),
    mutationCache: new MutationCache({ onError: showErrorNotification }),
    defaultOptions: {
      queries: { staleTime: STALE_TIME_MS, retry: shouldRetry },
      mutations: { retry: false },
    },
  });

  return queryClient;
}

export const queryClient = createQueryClient();
