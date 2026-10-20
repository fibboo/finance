import { queryOptions } from '@tanstack/react-query';

import { apiClient, readData } from '@/lib/api-client';
import type { components } from '@/lib/api-schema';

type User = components['schemas']['User'];

async function fetchMe(): Promise<User> {
  const user = readData(await apiClient.GET('/user/me'));
  return user;
}

export const userQueries = {
  me() {
    return queryOptions({ queryKey: ['user', 'me'], queryFn: fetchMe });
  },
};
