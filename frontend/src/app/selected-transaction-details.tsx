import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';

import { accountQueries } from '@/features/accounts/api/account-queries';
import { dictionaryQueries } from '@/features/dictionaries/api/dictionary-queries';
import { summaryQueries } from '@/features/summary/api/summary-queries';
import {
  readSelectedTransactionId,
  writeSelectedTransaction,
} from '@/features/transactions/api/selected-transaction';
import { TransactionDetails } from '@/features/transactions/components/transaction-details';

type SelectedTransactionDetailsProps = Readonly<{ baseCurrency: string }>;

export function SelectedTransactionDetails({ baseCurrency }: SelectedTransactionDetailsProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: dictionaries } = useQuery({
    ...dictionaryQueries.accounting(),
    throwOnError: true,
  });
  const selectedTransactionId = readSelectedTransactionId(searchParams);
  if (selectedTransactionId === undefined || dictionaries === undefined) {
    return null;
  }

  return (
    <TransactionDetails
      key={selectedTransactionId}
      transactionId={selectedTransactionId}
      baseCurrency={baseCurrency}
      transactionTypes={dictionaries.transaction_types}
      accountKinds={dictionaries.account_kinds}
      relatedQueryKeys={[accountQueries.all().queryKey, summaryQueries.current().queryKey]}
      onClose={() => {
        setSearchParams(writeSelectedTransaction({ searchParams, transactionId: undefined }), {
          preventScrollReset: true,
        });
      }}
    />
  );
}
