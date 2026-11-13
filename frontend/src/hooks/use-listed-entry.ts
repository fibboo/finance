import { type Dispatch, type SetStateAction, useState } from 'react';

export function useListedEntry<Entry extends Readonly<{ id: string }>>(
  entries: readonly Entry[] | undefined,
): readonly [Entry | undefined, Dispatch<SetStateAction<string | undefined>>] {
  const [entryId, setEntryId] = useState<string | undefined>(undefined);
  const entry = entries?.find((listedEntry) => listedEntry.id === entryId);
  if (entries !== undefined && entryId !== undefined && entry === undefined) {
    setEntryId(undefined);
  }
  return [entry, setEntryId];
}
