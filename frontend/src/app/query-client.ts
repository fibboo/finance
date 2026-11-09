import { MutationCache, type Query, QueryCache, QueryClient } from '@tanstack/react-query';

import { showErrorNotification } from '@/components/error-notification/error-notification-store';
import { ApiError, NOT_FOUND_STATUS, UNAUTHORIZED_STATUS } from '@/lib/api-error';
import { isNotFoundExpected } from '@/lib/query-meta';

const STALE_TIME_MS = 60_000;
const MAX_RETRIES = 3;

function shouldRetry(failureCount: number, error: unknown): boolean {
  const isClientError = error instanceof ApiError && error.status >= 400 && error.status < 500;
  const shouldRetryError = !isClientError && failureCount < MAX_RETRIES;

  return shouldRetryError;
}

function notifyError(error: Error): void {
  const hasEndedSession = error instanceof ApiError && error.status === UNAUTHORIZED_STATUS;
  if (!hasEndedSession) {
    showErrorNotification();
  }
}

function notifyQueryError(error: Error, query: Query<unknown, unknown, unknown>): void {
  const isExpectedNotFound =
    isNotFoundExpected(query.meta) &&
    error instanceof ApiError &&
    error.status === NOT_FOUND_STATUS;
  if (!isExpectedNotFound) {
    notifyError(error);
  }
}

function notifyMutationError(error: Error): void {
  const isFieldError = error instanceof ApiError && error.fieldErrors.length > 0;
  if (!isFieldError) {
    notifyError(error);
  }
}

export function createQueryClient(): QueryClient {
  const queryClient = new QueryClient({
    queryCache: new QueryCache({ onError: notifyQueryError }),
    mutationCache: new MutationCache({ onError: notifyMutationError }),
    defaultOptions: {
      queries: { staleTime: STALE_TIME_MS, retry: shouldRetry },
      mutations: { retry: false },
    },
  });

  return queryClient;
}

export const queryClient = createQueryClient();
