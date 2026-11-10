import { z } from 'zod';

export const SELECTED_TRANSACTION_PARAM = 'transaction';
const TRANSACTION_LINK_ID_PREFIX = 'transaction-link-';

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
    nextSearchParams.delete(SELECTED_TRANSACTION_PARAM);
    nextSearchParams.set(SELECTED_TRANSACTION_PARAM, transactionId);
  }

  return nextSearchParams;
}

export function readTransactionLinkId(transactionId: string): string {
  const linkId = `${TRANSACTION_LINK_ID_PREFIX}${transactionId}`;
  return linkId;
}

export function readNeighbourTransactionLinkId(transactionId: string): string | undefined {
  const linkIds = Array.from(
    document.querySelectorAll(`[id^="${TRANSACTION_LINK_ID_PREFIX}"]`),
    (link) => link.id,
  );
  const index = linkIds.indexOf(readTransactionLinkId(transactionId));
  const neighbourLinkId = index === -1 ? undefined : (linkIds[index + 1] ?? linkIds[index - 1]);
  return neighbourLinkId;
}
