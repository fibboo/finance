import { queryOptions } from '@tanstack/react-query';

import { apiClient, readData } from '@/lib/api-client';
import type { components, operations } from '@/lib/api-schema';

type AccountPage = components['schemas']['Page_Account_'];
type AccountListQuery = NonNullable<
  operations['get_accounts_accounting_accounts_get']['parameters']['query']
>;

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
