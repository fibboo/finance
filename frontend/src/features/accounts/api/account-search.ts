import { z } from 'zod';

const SEARCH_PARAM = 'search';
const SEARCH_TERM_MIN_LENGTH = 3;

export const ACCOUNT_SEARCH_FIELD_ID = 'account-search';

const typedSearchStateSchema = z.object({ isAccountSearchTyped: z.literal(true) });

export const TYPED_SEARCH_STATE = {
  isAccountSearchTyped: true,
} satisfies z.infer<typeof typedSearchStateSchema>;

export function readAccountSearch(searchParams: URLSearchParams): string {
  const search = searchParams.get(SEARCH_PARAM) ?? '';
  return search;
}

export function readAccountSearchTerm(search: string): string | undefined {
  const term = search.trim();
  const searchTerm = term.length >= SEARCH_TERM_MIN_LENGTH ? term : undefined;
  return searchTerm;
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

export function isAccountSearchTyped(locationState: unknown): boolean {
  const isTyped = typedSearchStateSchema.safeParse(locationState).success;
  return isTyped;
}
