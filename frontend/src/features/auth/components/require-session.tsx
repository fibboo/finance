import { useSyncExternalStore } from 'react';
import { Navigate, Outlet } from 'react-router';

import { readIsSignedIn, subscribeToSession } from '../api/session';

export function RequireSession() {
  const isSignedIn = useSyncExternalStore(subscribeToSession, readIsSignedIn);
  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />;
  }

  return <Outlet />;
}
