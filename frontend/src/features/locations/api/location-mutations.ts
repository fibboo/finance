import { mutationOptions } from '@tanstack/react-query';

import { apiClient, readData } from '@/lib/api-client';
import { ApiError } from '@/lib/api-error';
import type { components } from '@/lib/api-schema';

import { locationQueries } from './location-queries';

type Location = components['schemas']['Location'];
type LocationCreateRequest = components['schemas']['LocationCreateRequest'];

async function postLocation(body: Readonly<LocationCreateRequest>): Promise<Location> {
  try {
    const location = readData(await apiClient.POST('/accounting/locations', { body }));
    return location;
  } catch (error) {
    if (error instanceof ApiError && error.error_code === 'NAME_ALREADY_EXISTS') {
      throw new ApiError({
        status: error.status,
        message: error.message,
        error_code: error.error_code,
        fieldErrors: [{ field: 'name', message: error.message }],
      });
    }

    throw error;
  }
}

export const locationMutations = {
  create() {
    return mutationOptions({
      mutationFn: postLocation,
      onSuccess: (_location, _body, _onMutateResult, { client }) =>
        client.invalidateQueries({ queryKey: locationQueries.all().queryKey }),
    });
  },
};
