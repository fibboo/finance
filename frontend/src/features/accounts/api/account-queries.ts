import { queryOptions } from '@tanstack/react-query';

import { apiClient, readData } from '@/lib/api-client';
import type { components, operations } from '@/lib/api-schema';

type Account = components['schemas']['Account'];
type AccountPage = components['schemas']['Page_Account_'];
type AccountListQuery = NonNullable<
  operations['get_accounts_accounting_accounts_get']['parameters']['query']
>;

export const ACCOUNT_PAGE_SIZE = 100;

async function fetchAccounts(query: Readonly<AccountListQuery>): Promise<AccountPage> {
  const accounts = readData(await apiClient.GET('/accounting/accounts', { params: { query } }));
  return accounts;
}

async function fetchAccount(accountId: string): Promise<Account> {
  const account = readData(
    await apiClient.GET('/accounting/accounts/{account_id}', {
      params: { path: { account_id: accountId } },
    }),
  );
  return account;
}

const ACCOUNTS_KEY = ['accounts'] as const;

export const accountQueries = {
  all() {
    return { queryKey: ACCOUNTS_KEY };
  },
  list(query: Readonly<AccountListQuery>) {
    return queryOptions({
      queryKey: [...ACCOUNTS_KEY, 'list', query],
      queryFn: () => fetchAccounts(query),
    });
  },
  detail(accountId: string) {
    return queryOptions({
      queryKey: [...ACCOUNTS_KEY, 'detail', accountId],
      queryFn: () => fetchAccount(accountId),
      meta: { isNotFoundExpected: true },
    });
  },
};
