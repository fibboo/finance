import { type QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useEffect } from 'react';

import { subscribeToDataChanges } from '@/app/data-change-channel';
import { ErrorNotification } from '@/components/error-notification/error-notification';
import { useTheme } from '@/components/theme-switch/use-theme';
import { authMiddleware } from '@/features/auth/api/auth-middleware';
import { subscribeToSession } from '@/features/auth/api/session';
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
      subscribeToSession((change) => {
        if (change === 'signed-in') {
          void queryClient.resetQueries();
        }
        if (change === 'signed-out') {
          queryClient.removeQueries();
        }
      }),
    [queryClient],
  );
  useEffect(
    () =>
      subscribeToDataChanges(() => {
        void queryClient.invalidateQueries();
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
