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
  isDefaultAccountPending: boolean;
  isAccountOpenedLast: boolean;
}>;

type ShownAccountOptions = Readonly<{
  defaultTransactionId: string | undefined;
  isDefaultTransactionPending: boolean;
  firstAccountId: string | undefined;
  isFirstAccountPending: boolean;
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
  isDefaultTransactionPending,
  firstAccountId,
  isFirstAccountPending,
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
  const isShownTransactionPending =
    (shownTransactionId === undefined && isDefaultTransactionPending) ||
    (shownTransactionId !== undefined && shownTransaction === undefined);
  const defaultAccountId =
    transactionAccountId ??
    lastTransactionAccountId ??
    (isShownTransactionPending ? undefined : firstAccountId);
  const shownAccount = {
    chosenAccountId: readSelectedAccountId(searchParams),
    defaultAccountId,
    isDefaultAccountPending:
      defaultAccountId === undefined && (isShownTransactionPending || isFirstAccountPending),
    isAccountOpenedLast: readIsAccountOpenedLast(searchParams),
  };
  return shownAccount;
}
