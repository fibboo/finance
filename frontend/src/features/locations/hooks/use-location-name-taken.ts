import { useQuery } from '@tanstack/react-query';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { readSearchTerm } from '@/lib/search-term';

import { LOCATION_PAGE_SIZE, locationQueries } from '../api/location-queries';

type LocationNameLookup = Readonly<{
  name: string;
  ownLocationId: string | undefined;
}>;

export function useLocationNameTaken({
  name,
  ownLocationId,
}: LocationNameLookup): Readonly<{ isNameTaken: boolean; isLookupPending: boolean }> {
  const searchTerm = readSearchTerm(name) ?? null;
  const lookedUpSearchTerm = useDebouncedValue(searchTerm);
  const { data: locations, isPending } = useQuery({
    ...locationQueries.list({
      statuses: ['ACTIVE'],
      search_term: lookedUpSearchTerm,
      size: LOCATION_PAGE_SIZE,
    }),
    enabled: lookedUpSearchTerm !== null,
  });
  const isCurrentNameLookedUp = searchTerm === lookedUpSearchTerm;
  const nameTaken = {
    isNameTaken:
      isCurrentNameLookedUp &&
      (locations?.items.some(
        (location) => location.name === searchTerm && location.id !== ownLocationId,
      ) ??
        false),
    isLookupPending: searchTerm !== null && (!isCurrentNameLookedUp || isPending),
  };
  return nameTaken;
}
