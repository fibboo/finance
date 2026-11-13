import { z } from 'zod';

const SELECTED_LOCATION_PARAM = 'location';
const LOCATION_LINK_ID_PREFIX = 'location-link-';

export function readSelectedLocationId(searchParams: URLSearchParams): string | undefined {
  const parsedId = z.uuid().safeParse(searchParams.get(SELECTED_LOCATION_PARAM));
  const locationId = parsedId.success ? parsedId.data : undefined;
  return locationId;
}

export function writeSelectedLocation({
  searchParams,
  locationId,
}: Readonly<{ searchParams: URLSearchParams; locationId: string }>): URLSearchParams {
  const nextSearchParams = new URLSearchParams(searchParams);
  nextSearchParams.set(SELECTED_LOCATION_PARAM, locationId);
  return nextSearchParams;
}

export function readLocationLinkId(locationId: string): string {
  const linkId = `${LOCATION_LINK_ID_PREFIX}${locationId}`;
  return linkId;
}
