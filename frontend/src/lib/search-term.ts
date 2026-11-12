const SEARCH_TERM_MIN_LENGTH = 3;

export function readSearchTerm(search: string): string | undefined {
  const term = search.trim();
  const searchTerm = term.length >= SEARCH_TERM_MIN_LENGTH ? term : undefined;
  return searchTerm;
}
