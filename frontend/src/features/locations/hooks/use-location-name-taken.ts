import { useQuery } from '@tanstack/react-query';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { readSearchTerm } from '@/lib/search-term';

import { LOCATION_PAGE_SIZE, locationQueries } from '../api/location-queries';

type LocationNameLookup = Readonly<{
  name: string;
  ownLocationId: string | undefined;
  unchangedName: string | undefined;
}>;

const NAME_TAKEN_MESSAGE = 'An active location already has this name';

export function useLocationNameTaken({
  name,
  ownLocationId,
  unchangedName,
}: LocationNameLookup): Readonly<{
  isNameTaken: boolean;
  isLookupPending: boolean;
  nameTakenMessage: string;
}> {
  const searchTerm =
    name.trim() === unchangedName ? null : (readSearchTerm(name)?.toLowerCase() ?? null);
  const lookedUpSearchTerm = useDebouncedValue(searchTerm);
  const { data: locations, isPending } = useQuery({
    ...locationQueries.list({
      statuses: ['ACTIVE'],
      search_term: lookedUpSearchTerm,
      size: LOCATION_PAGE_SIZE,
    }),
    enabled: lookedUpSearchTerm !== null,
    retry: false,
    refetchInterval: false,
  });
  const isCurrentNameLookedUp = searchTerm === lookedUpSearchTerm;
  const nameTaken = {
    isNameTaken:
      isCurrentNameLookedUp &&
      (locations?.items.some(
        (location) => location.name.toLowerCase() === searchTerm && location.id !== ownLocationId,
      ) ??
        false),
    isLookupPending: searchTerm !== null && (!isCurrentNameLookedUp || isPending),
    nameTakenMessage: NAME_TAKEN_MESSAGE,
  };
  return nameTaken;
}
