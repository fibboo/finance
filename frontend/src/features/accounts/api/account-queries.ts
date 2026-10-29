import { queryOptions } from '@tanstack/react-query';

import { apiClient, readData } from '@/lib/api-client';
import type { components, operations } from '@/lib/api-schema';

type AccountPage = components['schemas']['Page_Account_'];
type AccountKind = components['schemas']['AccountKind'];
type AccountListQuery = NonNullable<
  operations['get_accounts_accounting_accounts_get']['parameters']['query']
>;

export const ACCOUNT_PAGE_SIZE = 100;
export const MONEY_ACCOUNT_KINDS: readonly AccountKind[] = ['ASSET', 'LIABILITY'];

async function fetchAccounts(query: Readonly<AccountListQuery>): Promise<AccountPage> {
  const accounts = readData(await apiClient.GET('/accounting/accounts', { params: { query } }));
  return accounts;
}

export const accountQueries = {
  list(query: Readonly<AccountListQuery>) {
    return queryOptions({
      queryKey: ['accounts', 'list', query],
      queryFn: () => fetchAccounts(query),
    });
  },
};
