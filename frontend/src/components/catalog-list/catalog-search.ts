const SEARCH_PARAM = 'search';

export function readCatalogSearch(searchParams: URLSearchParams): string {
  const search = searchParams.get(SEARCH_PARAM) ?? '';
  return search;
}

export function writeCatalogSearch({
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
