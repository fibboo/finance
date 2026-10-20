import { type QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useEffect } from 'react';

import { ErrorNotification } from '@/components/error-notification/error-notification';
import { useTheme } from '@/components/theme-switch/use-theme';
import { authMiddleware } from '@/features/auth/api/auth-middleware';
import { readIsSignedIn, subscribeToSession } from '@/features/auth/api/session';
import { apiClient } from '@/lib/api-client';

type ProvidersProps = Readonly<{
  queryClient: QueryClient;
  children: ReactNode;
}>;

apiClient.use(authMiddleware);

export function Providers({ queryClient, children }: ProvidersProps) {
  useTheme();
  useEffect(
    () =>
      subscribeToSession(() => {
        if (!readIsSignedIn()) {
          queryClient.removeQueries();
        }
      }),
    [queryClient],
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ErrorNotification />
    </QueryClientProvider>
  );
}
