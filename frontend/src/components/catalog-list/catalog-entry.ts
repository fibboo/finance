import type { components } from '@/lib/api-schema';

type EntityStatus = components['schemas']['EntityStatusType'];

export type CatalogEntry = Readonly<{
  id: string;
  name: string;
  description?: string | null;
  status: EntityStatus;
}>;

export type CatalogGroup<Entry extends CatalogEntry> = Readonly<{
  key: string;
  heading: string | undefined;
  entries: readonly Entry[];
}>;

export function readCatalogInitial(entry: CatalogEntry): string {
  const initial = entry.name.slice(0, 1).toUpperCase();
  return initial;
}
