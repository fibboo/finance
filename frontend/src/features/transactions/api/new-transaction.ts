import { z } from 'zod';

import type { components } from '@/lib/api-schema';

type TransactionType = components['schemas']['TransactionType'];

const NEW_TRANSACTION_PARAM = 'new_transaction';
const NEW_TRANSACTION_ACCOUNT_PARAM = 'new_transaction_account';

export const ENTRY_TRANSACTION_TYPES = [
  'EXPENSE',
  'INCOME',
  'TRANSFER',
  'ADJUSTMENT',
] as const satisfies readonly TransactionType[];

export type EntryTransactionType = (typeof ENTRY_TRANSACTION_TYPES)[number];

export type AdjustmentTransactionType = Extract<EntryTransactionType, 'ADJUSTMENT'>;

export type MovementTransactionType = Exclude<EntryTransactionType, AdjustmentTransactionType>;

export const DEFAULT_ENTRY_TRANSACTION_TYPE = 'EXPENSE' satisfies EntryTransactionType;

export function readNewTransactionType(
  searchParams: URLSearchParams,
): EntryTransactionType | undefined {
  const parsedType = z
    .enum(ENTRY_TRANSACTION_TYPES)
    .safeParse(searchParams.get(NEW_TRANSACTION_PARAM));
  const transactionType = parsedType.success ? parsedType.data : undefined;
  return transactionType;
}

export function writeNewTransactionType({
  searchParams,
  transactionType,
}: Readonly<{
  searchParams: URLSearchParams;
  transactionType: EntryTransactionType | undefined;
}>): URLSearchParams {
  const nextSearchParams = new URLSearchParams(searchParams);
  nextSearchParams.delete(NEW_TRANSACTION_ACCOUNT_PARAM);
  if (transactionType === undefined) {
    nextSearchParams.delete(NEW_TRANSACTION_PARAM);
  } else {
    nextSearchParams.set(NEW_TRANSACTION_PARAM, transactionType);
  }

  return nextSearchParams;
}

export function readNewTransactionAccountId(searchParams: URLSearchParams): string | undefined {
  const parsedId = z.uuid().safeParse(searchParams.get(NEW_TRANSACTION_ACCOUNT_PARAM));
  const accountId = parsedId.success ? parsedId.data : undefined;
  return accountId;
}

export function writeNewAdjustment({
  searchParams,
  accountId,
}: Readonly<{ searchParams: URLSearchParams; accountId: string }>): URLSearchParams {
  const nextSearchParams = writeNewTransactionType({ searchParams, transactionType: 'ADJUSTMENT' });
  nextSearchParams.set(NEW_TRANSACTION_ACCOUNT_PARAM, accountId);
  return nextSearchParams;
}
