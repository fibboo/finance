import { createBrowserRouter, type RouteObject } from 'react-router';

import { RootErrorBoundary } from '@/app/root-error-boundary';
import { BootScreen } from '@/components/boot-screen/boot-screen';
import { restoreSession } from '@/features/auth/api/session';

function preloadSectionRoutes() {
  void Promise.allSettled([
    import('@/app/routes/home'),
    import('@/app/routes/transactions'),
    import('@/app/routes/accounts'),
    import('@/app/routes/categories'),
    import('@/app/routes/locations'),
    import('@/app/routes/income-sources'),
  ]);
}

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
                  Component: async () => {
                    preloadSectionRoutes();
                    return (await import('@/app/app-layout')).AppLayout;
                  },
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
                    path: 'accounts',
                    ErrorBoundary: RootErrorBoundary,
                    lazy: () => import('@/app/routes/accounts'),
                  },
                  {
                    path: 'categories',
                    ErrorBoundary: RootErrorBoundary,
                    lazy: () => import('@/app/routes/categories'),
                  },
                  {
                    path: 'locations',
                    ErrorBoundary: RootErrorBoundary,
                    lazy: () => import('@/app/routes/locations'),
                  },
                  {
                    path: 'income-sources',
                    ErrorBoundary: RootErrorBoundary,
                    lazy: () => import('@/app/routes/income-sources'),
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
