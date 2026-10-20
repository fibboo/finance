import { createBrowserRouter, type RouteObject } from 'react-router';

import { RootErrorBoundary } from '@/app/root-error-boundary';

const routes: RouteObject[] = [
  {
    path: '/',
    ErrorBoundary: RootErrorBoundary,
    children: [
      {
        ErrorBoundary: RootErrorBoundary,
        lazy: {
          Component: async () => (await import('@/app/app-layout')).AppLayout,
        },
        children: [
          {
            index: true,
            ErrorBoundary: RootErrorBoundary,
            lazy: () => import('@/app/routes/home'),
          },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
