import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router';

import {
  readSelectedAccountId,
  SELECTED_ACCOUNT_PARAM,
} from '@/features/accounts/api/selected-account';
import {
  readSelectedTransactionId,
  SELECTED_TRANSACTION_PARAM,
} from '@/features/transactions/api/selected-transaction';
import { transactionQueries } from '@/features/transactions/api/transaction-queries';
import { readFirstMoneyAccountId } from '@/features/transactions/components/transaction-view';

export type ShownAccount = Readonly<{
  chosenAccountId: string | undefined;
  defaultAccountId: string | undefined;
  isAccountParamStale: boolean;
  isAccountOpenedLast: boolean;
}>;

type ShownAccountOptions = Readonly<{
  defaultTransactionId: string | undefined;
  firstAccountId: string | undefined;
}>;

function readIsAccountOpenedLast(searchParams: URLSearchParams): boolean {
  const keys = [...searchParams.keys()];
  const isAccountOpenedLast =
    readSelectedAccountId(searchParams) !== undefined &&
    (readSelectedTransactionId(searchParams) === undefined ||
      keys.indexOf(SELECTED_ACCOUNT_PARAM) > keys.indexOf(SELECTED_TRANSACTION_PARAM));
  return isAccountOpenedLast;
}

export function useShownAccount({
  defaultTransactionId,
  firstAccountId,
}: ShownAccountOptions): ShownAccount {
  const [searchParams] = useSearchParams();
  const shownTransactionId = readSelectedTransactionId(searchParams) ?? defaultTransactionId;
  const { data: shownTransaction } = useQuery({
    ...transactionQueries.detail(shownTransactionId ?? ''),
    enabled: false,
    placeholderData: keepPreviousData,
  });
  const transactionAccountId =
    shownTransaction === undefined ? undefined : readFirstMoneyAccountId(shownTransaction);
  const [lastTransactionAccountId, setLastTransactionAccountId] = useState(transactionAccountId);
  if (transactionAccountId !== undefined && transactionAccountId !== lastTransactionAccountId) {
    setLastTransactionAccountId(transactionAccountId);
  }
  const selectedAccountId = readSelectedAccountId(searchParams);
  const isAccountOpenedLast = readIsAccountOpenedLast(searchParams);
  const isAccountParamStale =
    selectedAccountId !== undefined &&
    !isAccountOpenedLast &&
    shownTransaction !== undefined &&
    !shownTransaction.postings.some((posting) => posting.account.id === selectedAccountId);
  const shownAccount = {
    chosenAccountId: isAccountParamStale ? undefined : selectedAccountId,
    defaultAccountId: transactionAccountId ?? lastTransactionAccountId ?? firstAccountId,
    isAccountParamStale,
    isAccountOpenedLast,
  };
  return shownAccount;
}
