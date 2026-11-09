import { useQuery } from '@tanstack/react-query';
import { Navigate, useSearchParams } from 'react-router';

import { accountQueries } from '@/features/accounts/api/account-queries';
import {
  readSelectedAccountId,
  writeSelectedAccount,
} from '@/features/accounts/api/selected-account';
import { AccountDetails } from '@/features/accounts/components/account-details';
import { dictionaryQueries } from '@/features/dictionaries/api/dictionary-queries';
import { writeNewAdjustment } from '@/features/transactions/api/new-transaction';
import { writeTransactionFilters } from '@/features/transactions/api/transaction-filters';
import { ApiError, NOT_FOUND_STATUS } from '@/lib/api-error';

type SelectedAccountDetailsProps = Readonly<{ baseCurrency: string }>;

export function SelectedAccountDetails({ baseCurrency }: SelectedAccountDetailsProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedAccountId = readSelectedAccountId(searchParams);
  const { error } = useQuery({
    ...accountQueries.detail(selectedAccountId ?? ''),
    enabled: selectedAccountId !== undefined,
  });
  const { data: dictionaries } = useQuery(dictionaryQueries.accounting());
  if (selectedAccountId === undefined || dictionaries === undefined) {
    return null;
  }

  if (error instanceof ApiError && error.status === NOT_FOUND_STATUS) {
    return (
      <Navigate
        to={{ search: writeSelectedAccount({ searchParams, accountId: undefined }).toString() }}
        replace
      />
    );
  }

  return (
    <AccountDetails
      key={selectedAccountId}
      accountId={selectedAccountId}
      baseCurrency={baseCurrency}
      accountKinds={dictionaries.account_kinds}
      adjustBalanceLink={{
        search: writeNewAdjustment({ searchParams, accountId: selectedAccountId }).toString(),
      }}
      transactionsLink={{
        pathname: '/transactions',
        search: writeTransactionFilters({
          transaction_types: [],
          account_ids: [selectedAccountId],
          category_ids: [],
          income_source_ids: [],
        }).toString(),
      }}
      onClose={() => {
        setSearchParams(writeSelectedAccount({ searchParams, accountId: undefined }), {
          preventScrollReset: true,
        });
      }}
    />
  );
}
