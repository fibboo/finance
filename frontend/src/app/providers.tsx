import { type QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { ErrorNotification } from '@/components/error-notification/error-notification';
import { useTheme } from '@/components/theme-switch/use-theme';

type ProvidersProps = Readonly<{
  queryClient: QueryClient;
  children: ReactNode;
}>;

export function Providers({ queryClient, children }: ProvidersProps) {
  useTheme();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ErrorNotification />
    </QueryClientProvider>
  );
}
