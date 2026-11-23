import { createHashRouter as createBrowserRouter, type RouteObject } from 'react-router';

import { RootErrorBoundary } from '@/app/root-error-boundary';
import { BootScreen } from '@/components/boot-screen/boot-screen';
import { restoreSession } from '@/features/auth/api/session';
import { markRouteLoaded } from '@/hooks/loaded-routes';

async function loadSectionRoute<RouteModule>({
  pathname,
  importRoute,
}: Readonly<{ pathname: string; importRoute: () => Promise<RouteModule> }>): Promise<RouteModule> {
  const routeModule = await importRoute();
  markRouteLoaded(pathname);
  return routeModule;
}

function importHomeRoute() {
  return loadSectionRoute({
    pathname: '/',
    importRoute: () => import('@/app/routes/home'),
  });
}

function importTransactionsRoute() {
  return loadSectionRoute({
    pathname: '/transactions',
    importRoute: () => import('@/app/routes/transactions'),
  });
}

function importAccountsRoute() {
  return loadSectionRoute({
    pathname: '/accounts',
    importRoute: () => import('@/app/routes/accounts'),
  });
}

function importCategoriesRoute() {
  return loadSectionRoute({
    pathname: '/categories',
    importRoute: () => import('@/app/routes/categories'),
  });
}

function importLocationsRoute() {
  return loadSectionRoute({
    pathname: '/locations',
    importRoute: () => import('@/app/routes/locations'),
  });
}

function importIncomeSourcesRoute() {
  return loadSectionRoute({
    pathname: '/income-sources',
    importRoute: () => import('@/app/routes/income-sources'),
  });
}

function preloadSectionRoutes() {
  void Promise.allSettled([
    importHomeRoute(),
    importTransactionsRoute(),
    importAccountsRoute(),
    importCategoriesRoute(),
    importLocationsRoute(),
    importIncomeSourcesRoute(),
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
                    const { AppLayout } = await import('@/app/app-layout');
                    preloadSectionRoutes();
                    return AppLayout;
                  },
                },
                children: [
                  {
                    index: true,
                    ErrorBoundary: RootErrorBoundary,
                    lazy: importHomeRoute,
                  },
                  {
                    path: 'transactions',
                    ErrorBoundary: RootErrorBoundary,
                    lazy: importTransactionsRoute,
                  },
                  {
                    path: 'accounts',
                    ErrorBoundary: RootErrorBoundary,
                    lazy: importAccountsRoute,
                  },
                  {
                    path: 'categories',
                    ErrorBoundary: RootErrorBoundary,
                    lazy: importCategoriesRoute,
                  },
                  {
                    path: 'locations',
                    ErrorBoundary: RootErrorBoundary,
                    lazy: importLocationsRoute,
                  },
                  {
                    path: 'income-sources',
                    ErrorBoundary: RootErrorBoundary,
                    lazy: importIncomeSourcesRoute,
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
