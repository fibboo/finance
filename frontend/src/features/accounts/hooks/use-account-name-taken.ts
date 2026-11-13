import { useQuery } from '@tanstack/react-query';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import type { components } from '@/lib/api-schema';
import { readSearchTerm } from '@/lib/search-term';

import { ACCOUNT_PAGE_SIZE, accountQueries } from '../api/account-queries';

type AccountKind = components['schemas']['AccountKind'];

type AccountNameLookup = Readonly<{
  name: string;
  kind: AccountKind;
  ownAccountId: string | undefined;
}>;

export function useAccountNameTaken({
  name,
  kind,
  ownAccountId,
}: AccountNameLookup): Readonly<{ isNameTaken: boolean; isLookupPending: boolean }> {
  const searchTerm = readSearchTerm(name) ?? null;
  const lookedUpSearchTerm = useDebouncedValue(searchTerm);
  const { data: accounts, isPending } = useQuery({
    ...accountQueries.list({
      kinds: [kind],
      statuses: ['ACTIVE'],
      search_term: lookedUpSearchTerm,
      size: ACCOUNT_PAGE_SIZE,
    }),
    enabled: lookedUpSearchTerm !== null,
  });
  const isCurrentNameLookedUp = searchTerm === lookedUpSearchTerm;
  const nameTaken = {
    isNameTaken:
      isCurrentNameLookedUp &&
      (accounts?.items.some(
        (account) => account.name === searchTerm && account.id !== ownAccountId,
      ) ??
        false),
    isLookupPending: searchTerm !== null && (!isCurrentNameLookedUp || isPending),
  };
  return nameTaken;
}
