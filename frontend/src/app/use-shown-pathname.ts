import { useLocation, useNavigation } from 'react-router';

export function useShownPathname(): Readonly<{ pathname: string; isPending: boolean }> {
  const location = useLocation();
  const navigation = useNavigation();
  const isPending =
    navigation.state === 'loading' && navigation.location.pathname !== location.pathname;
  const shownPathname = {
    pathname: isPending ? navigation.location.pathname : location.pathname,
    isPending,
  };
  return shownPathname;
}
