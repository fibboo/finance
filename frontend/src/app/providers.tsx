import { type QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { ErrorNotification } from '@/components/error-notification/error-notification';
import { useTheme } from '@/components/theme-switch/use-theme';
import { authMiddleware } from '@/features/auth/api/auth-middleware';
import { apiClient } from '@/lib/api-client';

type ProvidersProps = Readonly<{
  queryClient: QueryClient;
  children: ReactNode;
}>;

apiClient.use(authMiddleware);

export function Providers({ queryClient, children }: ProvidersProps) {
  useTheme();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ErrorNotification />
    </QueryClientProvider>
  );
}
