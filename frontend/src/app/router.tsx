import { createBrowserRouter, type RouteObject } from 'react-router';

import { RootErrorBoundary } from '@/app/root-error-boundary';
import { restoreSession } from '@/features/auth/api/session';
import { AuthCallbackPage } from '@/features/auth/components/auth-callback-page';

const routes: RouteObject[] = [
  {
    path: '/',
    ErrorBoundary: RootErrorBoundary,
    children: [
      {
        path: 'sign-in',
        ErrorBoundary: RootErrorBoundary,
        lazy: {
          Component: async () =>
            (await import('@/features/auth/components/sign-in-page')).SignInPage,
        },
      },
      {
        path: 'auth/callback',
        ErrorBoundary: RootErrorBoundary,
        HydrateFallback: AuthCallbackPage,
        lazy: {
          loader: async () => (await import('@/features/auth/api/complete-sign-in')).completeSignIn,
        },
      },
      {
        ErrorBoundary: RootErrorBoundary,
        loader: restoreSession,
        lazy: {
          Component: async () =>
            (await import('@/features/auth/components/require-session')).RequireSession,
        },
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
    ],
  },
];

export const router = createBrowserRouter(routes);
