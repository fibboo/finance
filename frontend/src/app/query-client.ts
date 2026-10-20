import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';

import { showErrorNotification } from '@/components/error-notification/error-notification-store';
import { ApiError } from '@/lib/api-error';

const STALE_TIME_MS = 60_000;
const MAX_RETRIES = 3;

function shouldRetry(failureCount: number, error: unknown): boolean {
  const isClientError = error instanceof ApiError && error.status >= 400 && error.status < 500;
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
