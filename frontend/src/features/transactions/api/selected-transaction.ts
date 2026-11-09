import { z } from 'zod';

export const SELECTED_TRANSACTION_PARAM = 'transaction';

export function readSelectedTransactionId(searchParams: URLSearchParams): string | undefined {
  const parsedId = z.uuid().safeParse(searchParams.get(SELECTED_TRANSACTION_PARAM));
  const transactionId = parsedId.success ? parsedId.data : undefined;
  return transactionId;
}

export function writeSelectedTransaction({
  searchParams,
  transactionId,
}: Readonly<{
  searchParams: URLSearchParams;
  transactionId: string | undefined;
}>): URLSearchParams {
  const nextSearchParams = new URLSearchParams(searchParams);
  if (transactionId === undefined) {
    nextSearchParams.delete(SELECTED_TRANSACTION_PARAM);
  } else {
    nextSearchParams.set(SELECTED_TRANSACTION_PARAM, transactionId);
  }

  return nextSearchParams;
}

export function readTransactionLinkId(transactionId: string): string {
  const linkId = `transaction-link-${transactionId}`;
  return linkId;
}
