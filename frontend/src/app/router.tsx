import { createBrowserRouter, type RouteObject } from 'react-router';

import { RootErrorBoundary } from '@/app/root-error-boundary';
import { BootScreen } from '@/components/boot-screen/boot-screen';
import { restoreSession } from '@/features/auth/api/session';

const routes: RouteObject[] = [
  {
    path: '/',
    ErrorBoundary: RootErrorBoundary,
    HydrateFallback: BootScreen,
    children: [
      {
        path: 'sign-in',
        ErrorBoundary: RootErrorBoundary,
        lazy: () => import('@/app/routes/sign-in'),
      },
      {
        path: 'auth/callback',
        ErrorBoundary: RootErrorBoundary,
        hydrateFallbackElement: <BootScreen label="Signing in" />,
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
              Component: async () => (await import('@/app/require-onboarding')).RequireOnboarding,
            },
            children: [
              {
                path: 'onboarding',
                ErrorBoundary: RootErrorBoundary,
                lazy: () => import('@/app/routes/onboarding'),
              },
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
                  {
                    path: 'transactions',
                    ErrorBoundary: RootErrorBoundary,
                    lazy: () => import('@/app/routes/transactions'),
                  },
                  {
                    path: 'auth/link-callback',
                    ErrorBoundary: RootErrorBoundary,
                    lazy: () => import('@/app/routes/link-callback'),
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
