import { useSuspenseQuery } from '@tanstack/react-query';
import { Navigate, Outlet, useLocation } from 'react-router';

import { userQueries } from '@/features/user/api/user-queries';

const ONBOARDING_PATH = '/onboarding';

export function RequireOnboarding() {
  const { data: user } = useSuspenseQuery(userQueries.me());
  const { pathname } = useLocation();
  const isOnboarded = (user.base_currency ?? null) !== null;
  const isOnOnboarding = pathname === ONBOARDING_PATH;
  if (!isOnboarded && !isOnOnboarding) {
    return <Navigate to={ONBOARDING_PATH} replace />;
  }

  if (isOnboarded && isOnOnboarding) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
