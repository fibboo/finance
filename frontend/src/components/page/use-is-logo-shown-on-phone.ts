import { useMatches } from 'react-router';

function readIsLogoShownOnPhone(handle: unknown): boolean {
  const isLogoShownOnPhone =
    typeof handle === 'object' &&
    handle !== null &&
    'isLogoShownOnPhone' in handle &&
    handle.isLogoShownOnPhone === true;
  return isLogoShownOnPhone;
}

export function useIsLogoShownOnPhone(): boolean {
  const isLogoShownOnPhone = useMatches().some((match) => readIsLogoShownOnPhone(match.handle));
  return isLogoShownOnPhone;
}
