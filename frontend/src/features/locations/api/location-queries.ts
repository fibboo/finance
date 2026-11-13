import { queryOptions } from '@tanstack/react-query';

import { apiClient, readData } from '@/lib/api-client';
import type { components, operations } from '@/lib/api-schema';

type Location = components['schemas']['Location'];
type LocationPage = components['schemas']['Page_Location_'];
type LocationListQuery = NonNullable<
  operations['get_locations_accounting_locations_get']['parameters']['query']
>;

export const LOCATION_PAGE_SIZE = 100;

async function fetchLocations(query: Readonly<LocationListQuery>): Promise<LocationPage> {
  const locations = readData(await apiClient.GET('/accounting/locations', { params: { query } }));
  return locations;
}

async function fetchLocation(locationId: string): Promise<Location> {
  const location = readData(
    await apiClient.GET('/accounting/locations/{location_id}', {
      params: { path: { location_id: locationId } },
    }),
  );
  return location;
}

const LOCATIONS_KEY = ['locations'] as const;

export const locationQueries = {
  all() {
    return { queryKey: LOCATIONS_KEY };
  },
  list(query: Readonly<LocationListQuery>) {
    return queryOptions({
      queryKey: [...LOCATIONS_KEY, 'list', query],
      queryFn: () => fetchLocations(query),
    });
  },
  detail(locationId: string) {
    return queryOptions({
      queryKey: [...LOCATIONS_KEY, 'detail', locationId],
      queryFn: () => fetchLocation(locationId),
    });
  },
};
