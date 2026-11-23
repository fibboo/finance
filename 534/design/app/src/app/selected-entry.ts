import { z } from 'zod';

import { writeSelectedTransaction } from '@/features/transactions/api/selected-transaction';

const SELECTED_ENTRY_PARAM = 'entry';
const ENTRY_SEPARATOR = '.';

const selectedEntrySchema = z
  .string()
  .transform((value) => value.split(ENTRY_SEPARATOR))
  .pipe(z.tuple([z.enum(['account', 'location']), z.uuid()]))
  .transform(([kind, id]) => ({ kind, id }));

export type SelectedEntry = Readonly<z.output<typeof selectedEntrySchema>>;

export function readSelectedEntry(searchParams: URLSearchParams): SelectedEntry | undefined {
  const parsedEntry = selectedEntrySchema.safeParse(searchParams.get(SELECTED_ENTRY_PARAM));
  const entry = parsedEntry.success ? parsedEntry.data : undefined;
  return entry;
}

export function writeSelectedEntry({
  searchParams,
  entry,
}: Readonly<{
  searchParams: URLSearchParams;
  entry: SelectedEntry | undefined;
}>): URLSearchParams {
  const nextSearchParams = new URLSearchParams(searchParams);
  nextSearchParams.delete(SELECTED_ENTRY_PARAM);
  if (entry !== undefined) {
    nextSearchParams.set(SELECTED_ENTRY_PARAM, `${entry.kind}${ENTRY_SEPARATOR}${entry.id}`);
  }

  return nextSearchParams;
}

export function writeClosedEntry(searchParams: URLSearchParams): URLSearchParams {
  const closedSearchParams = writeSelectedTransaction({
    searchParams: writeSelectedEntry({ searchParams, entry: undefined }),
    transactionId: undefined,
  });
  return closedSearchParams;
}
