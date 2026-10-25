import { useQuery } from '@tanstack/react-query';

import { userQueries } from '@/features/user/api/user-queries';

export function useBaseCurrency(): string | undefined {
  const { data: user } = useQuery(userQueries.me());
  if (user?.base_currency === null) {
    throw new Error('The signed-in user has no base currency yet.');
  }

  return user?.base_currency;
}
