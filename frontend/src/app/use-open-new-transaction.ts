import { useSearchParams } from 'react-router';

import {
  DEFAULT_ENTRY_TRANSACTION_TYPE,
  writeNewTransactionType,
} from '@/features/transactions/api/new-transaction';

export function useOpenNewTransaction(): () => void {
  const [searchParams, setSearchParams] = useSearchParams();
  function openNewTransaction() {
    setSearchParams(
      writeNewTransactionType({ searchParams, transactionType: DEFAULT_ENTRY_TRANSACTION_TYPE }),
      { preventScrollReset: true },
    );
  }

  return openNewTransaction;
}
