import { useMatches } from 'react-router';

import { useShownPathname } from '@/hooks/use-shown-pathname';

function readIsLogoShownOnPhone(handle: unknown): boolean {
  const isLogoShownOnPhone =
    typeof handle === 'object' &&
    handle !== null &&
    'isLogoShownOnPhone' in handle &&
    handle.isLogoShownOnPhone === true;
  return isLogoShownOnPhone;
}

export function useIsLogoShownOnPhone(): boolean {
  const { isPending } = useShownPathname();
  const matches = useMatches();
  const isLogoShownOnPhone =
    !isPending && matches.some((match) => readIsLogoShownOnPhone(match.handle));
  return isLogoShownOnPhone;
}
