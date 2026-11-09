import { MutationCache, type Query, QueryCache, QueryClient } from '@tanstack/react-query';

import { announceDataChange } from '@/app/data-change-channel';
import { showErrorNotification } from '@/components/error-notification/error-notification-store';
import { ApiError, NOT_FOUND_STATUS, UNAUTHORIZED_STATUS } from '@/lib/api-error';
import { isNotFoundExpected } from '@/lib/query-meta';

const STALE_TIME_MS = 60_000;
const POLLING_INTERVAL_MS = 30_000;
const MAX_RETRIES = 3;

function shouldRetry(failureCount: number, error: unknown): boolean {
  const isClientError = error instanceof ApiError && error.status >= 400 && error.status < 500;
  const shouldRetryError = !isClientError && failureCount < MAX_RETRIES;

  return shouldRetryError;
}

function hasEndedSession(error: Error): boolean {
  const isUnauthorized = error instanceof ApiError && error.status === UNAUTHORIZED_STATUS;
  return isUnauthorized;
}

function isQueryErrorNotified(error: Error, query: Query<unknown, unknown, unknown>): boolean {
  const isExpectedNotFound =
    isNotFoundExpected(query.meta) &&
    error instanceof ApiError &&
    error.status === NOT_FOUND_STATUS;
  const isNotified = !isExpectedNotFound && !hasEndedSession(error);
  return isNotified;
}

function notifyMutationError(error: Error): void {
  const isFieldError = error instanceof ApiError && error.fieldErrors.length > 0;
  if (!isFieldError && !hasEndedSession(error)) {
    showErrorNotification();
  }
}

export function createQueryClient(): QueryClient {
  let notifiedQueries = new WeakSet<Query<unknown, unknown, unknown>>();
  const queryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (!notifiedQueries.has(query) && isQueryErrorNotified(error, query)) {
          notifiedQueries.add(query);
          showErrorNotification();
        }
      },
      onSuccess: (_data, query) => {
        notifiedQueries.delete(query);
      },
    }),
    mutationCache: new MutationCache({
      onError: notifyMutationError,
      onSuccess: () => {
        notifiedQueries = new WeakSet();
        announceDataChange();
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: STALE_TIME_MS,
        retry: shouldRetry,
        refetchInterval: POLLING_INTERVAL_MS,
        refetchOnWindowFocus: 'always',
      },
      mutations: { retry: false },
    },
  });

  return queryClient;
}

export const queryClient = createQueryClient();
