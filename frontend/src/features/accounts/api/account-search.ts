const SEARCH_PARAM = 'search';

export const ACCOUNT_SEARCH_FIELD_ID = 'account-search';

export function readAccountSearch(searchParams: URLSearchParams): string {
  const search = searchParams.get(SEARCH_PARAM) ?? '';
  return search;
}

export function writeAccountSearch({
  searchParams,
  search,
}: Readonly<{ searchParams: URLSearchParams; search: string }>): URLSearchParams {
  const nextSearchParams = new URLSearchParams(searchParams);
  if (search === '') {
    nextSearchParams.delete(SEARCH_PARAM);
  } else {
    nextSearchParams.set(SEARCH_PARAM, search);
  }

  return nextSearchParams;
}
