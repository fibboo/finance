import { useSyncExternalStore } from 'react';
import { useLocation, useNavigation } from 'react-router';

import { isRouteLoaded, subscribeToLoadedRoutes } from './loaded-routes';

export function useShownPathname(): Readonly<{ pathname: string; isPending: boolean }> {
  const location = useLocation();
  const navigation = useNavigation();
  const targetPathname = navigation.location?.pathname;
  const isTargetLoaded = useSyncExternalStore(subscribeToLoadedRoutes, () =>
    targetPathname === undefined ? false : isRouteLoaded(targetPathname),
  );
  const isPending =
    navigation.state === 'loading' &&
    targetPathname !== undefined &&
    targetPathname !== location.pathname &&
    !isTargetLoaded;
  const shownPathname = {
    pathname: isPending ? targetPathname : location.pathname,
    isPending,
  };
  return shownPathname;
}
