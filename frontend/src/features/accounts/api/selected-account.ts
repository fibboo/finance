import { z } from 'zod';

const ACCOUNT_PARAM = 'account';

export function readSelectedAccountId(searchParams: URLSearchParams): string | undefined {
  const parsedId = z.uuid().safeParse(searchParams.get(ACCOUNT_PARAM));
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
    nextSearchParams.delete(ACCOUNT_PARAM);
  } else {
    nextSearchParams.set(ACCOUNT_PARAM, accountId);
  }

  return nextSearchParams;
}

export function readAccountLinkId(accountId: string): string {
  const linkId = `account-link-${accountId}`;
  return linkId;
}
