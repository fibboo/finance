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
  unchangedName: string | undefined;
}>;

const NAME_TAKEN_MESSAGES_BY_KIND = {
  ASSET: 'An active account already has this name',
  LIABILITY: 'An active account already has this name',
  EQUITY: 'An active account already has this name',
  EXPENSE: 'An active category already has this name',
  INCOME: 'An active income source already has this name',
} as const satisfies Readonly<Record<AccountKind, string>>;

export function useAccountNameTaken({
  name,
  kind,
  ownAccountId,
  unchangedName,
}: AccountNameLookup): Readonly<{
  isNameTaken: boolean;
  isLookupPending: boolean;
  nameTakenMessage: string;
}> {
  const searchTerm = name.trim() === unchangedName ? null : (readSearchTerm(name) ?? null);
  const lookedUpSearchTerm = useDebouncedValue(searchTerm);
  const { data: accounts, isPending } = useQuery({
    ...accountQueries.list({
      kinds: [kind],
      statuses: ['ACTIVE'],
      search_term: lookedUpSearchTerm,
      size: ACCOUNT_PAGE_SIZE,
    }),
    enabled: lookedUpSearchTerm !== null,
    retry: false,
    refetchInterval: false,
  });
  const isCurrentNameLookedUp = searchTerm === lookedUpSearchTerm;
  const nameTaken = {
    isNameTaken:
      isCurrentNameLookedUp &&
      (accounts?.items.some(
        (account) =>
          account.name.toLowerCase() === searchTerm?.toLowerCase() && account.id !== ownAccountId,
      ) ??
        false),
    isLookupPending: searchTerm !== null && (!isCurrentNameLookedUp || isPending),
    nameTakenMessage: NAME_TAKEN_MESSAGES_BY_KIND[kind],
  };
  return nameTaken;
}
