import { z } from 'zod';

const TRANSACTION_PARAM = 'transaction';

export function readSelectedTransactionId(searchParams: URLSearchParams): string | undefined {
  const parsedId = z.uuid().safeParse(searchParams.get(TRANSACTION_PARAM));
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
    nextSearchParams.delete(TRANSACTION_PARAM);
  } else {
    nextSearchParams.set(TRANSACTION_PARAM, transactionId);
  }

  return nextSearchParams;
}

export function readTransactionLinkId(transactionId: string): string {
  const linkId = `transaction-link-${transactionId}`;
  return linkId;
}
