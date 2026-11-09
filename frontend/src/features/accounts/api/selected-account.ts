import { z } from 'zod';

export const SELECTED_ACCOUNT_PARAM = 'account';
const ACCOUNT_LINK_ID_PREFIX = 'account-link-';

export function readSelectedAccountId(searchParams: URLSearchParams): string | undefined {
  const parsedId = z.uuid().safeParse(searchParams.get(SELECTED_ACCOUNT_PARAM));
  const accountId = parsedId.success ? parsedId.data : undefined;
  return accountId;
}

export function writeSelectedAccount({
  searchParams,
  accountId,
}: Readonly<{
  searchParams: URLSearchParams;
  accountId: string | undefined;
}>): URLSearchParams {
  const nextSearchParams = new URLSearchParams(searchParams);
  if (accountId === undefined) {
    nextSearchParams.delete(SELECTED_ACCOUNT_PARAM);
  } else {
    nextSearchParams.set(SELECTED_ACCOUNT_PARAM, accountId);
  }

  return nextSearchParams;
}

export function readAccountLinkId(accountId: string): string {
  const linkId = `${ACCOUNT_LINK_ID_PREFIX}${accountId}`;
  return linkId;
}

export function readNeighbourAccountLinkId(accountId: string): string | undefined {
  const linkIds = Array.from(
    document.querySelectorAll(`[id^="${ACCOUNT_LINK_ID_PREFIX}"]`),
    (link) => link.id,
  );
  const index = linkIds.indexOf(readAccountLinkId(accountId));
  const neighbourLinkId = index === -1 ? undefined : (linkIds[index + 1] ?? linkIds[index - 1]);
  return neighbourLinkId;
}
