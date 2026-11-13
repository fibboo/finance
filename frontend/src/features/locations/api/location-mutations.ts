import { mutationOptions, type QueryClient, type QueryKey } from '@tanstack/react-query';

import { apiClient, readData } from '@/lib/api-client';
import { ApiError } from '@/lib/api-error';
import type { components } from '@/lib/api-schema';

import { locationQueries } from './location-queries';

type Location = components['schemas']['Location'];
type LocationCreateRequest = components['schemas']['LocationCreateRequest'];
type LocationRestoreRequest = components['schemas']['LocationRestoreRequest'];
type LocationUpdate = components['schemas']['LocationUpdate'];

function readNameError(error: unknown): unknown {
  const nameError =
    error instanceof ApiError && error.error_code === 'NAME_ALREADY_EXISTS'
      ? new ApiError({
          status: error.status,
          message: error.message,
          error_code: error.error_code,
          fieldErrors: [{ field: 'name', message: error.message }],
        })
      : error;
  return nameError;
}

async function postLocation(body: Readonly<LocationCreateRequest>): Promise<Location> {
  try {
    const location = readData(await apiClient.POST('/accounting/locations', { body }));
    return location;
  } catch (error) {
    throw readNameError(error);
  }
}

async function putLocation({
  location_id,
  ...body
}: Readonly<LocationUpdate & { location_id: string }>): Promise<Location> {
  try {
    const location = readData(
      await apiClient.PUT('/accounting/locations/{location_id}', {
        params: { path: { location_id } },
        body,
      }),
    );
    return location;
  } catch (error) {
    throw readNameError(error);
  }
}

async function deleteLocation(locationId: string): Promise<Location> {
  const deletedLocation = readData(
    await apiClient.DELETE('/accounting/locations/{location_id}', {
      params: { path: { location_id: locationId } },
    }),
  );
  return deletedLocation;
}

async function restoreLocation({
  location_id,
  ...body
}: Readonly<LocationRestoreRequest & { location_id: string }>): Promise<Location> {
  try {
    const restoredLocation = readData(
      await apiClient.POST('/accounting/locations/{location_id}/restore', {
        params: { path: { location_id } },
        body,
      }),
    );
    return restoredLocation;
  } catch (error) {
    throw readNameError(error);
  }
}

async function invalidateLocationQueries({
  client,
  relatedQueryKeys,
}: Readonly<{ client: QueryClient; relatedQueryKeys: readonly QueryKey[] }>): Promise<void> {
  await Promise.all(
    [locationQueries.all().queryKey, ...relatedQueryKeys].map((queryKey) =>
      client.invalidateQueries({ queryKey }),
    ),
  );
}

export const locationMutations = {
  create() {
    return mutationOptions({
      mutationFn: postLocation,
      onSuccess: (_location, _body, _onMutateResult, { client }) =>
        client.invalidateQueries({ queryKey: locationQueries.all().queryKey }),
    });
  },
  update(relatedQueryKeys: readonly QueryKey[]) {
    return mutationOptions({
      mutationFn: putLocation,
      onSuccess: (_location, _body, _onMutateResult, { client }) =>
        invalidateLocationQueries({ client, relatedQueryKeys }),
    });
  },
  delete(relatedQueryKeys: readonly QueryKey[]) {
    return mutationOptions({
      mutationFn: deleteLocation,
      onSuccess: (_location, _locationId, _onMutateResult, { client }) =>
        invalidateLocationQueries({ client, relatedQueryKeys }),
      onError: (_error, _locationId, _onMutateResult, { client }) =>
        client.invalidateQueries({ queryKey: locationQueries.all().queryKey }),
    });
  },
  restore(relatedQueryKeys: readonly QueryKey[]) {
    return mutationOptions({
      mutationFn: restoreLocation,
      onSuccess: (_location, _restore, _onMutateResult, { client }) =>
        invalidateLocationQueries({ client, relatedQueryKeys }),
      onError: (_error, _restore, _onMutateResult, { client }) =>
        client.invalidateQueries({ queryKey: locationQueries.all().queryKey }),
    });
  },
};
