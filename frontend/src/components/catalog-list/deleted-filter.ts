import { useSyncExternalStore } from 'react';
import { z } from 'zod';

export type CatalogPage = 'categories' | 'income_sources' | 'locations';

const DELETED_PARAM = 'deleted';
const DELETED_ON = 'on';
const DELETED_OFF = 'off';

const deletedFilterSchema = z.enum([DELETED_ON, DELETED_OFF]);
const deletedFilterListeners = new Set<() => void>();

function readStorageKey(page: CatalogPage): string {
  const storageKey = `deleted:${page}`;
  return storageKey;
}

function subscribe(listener: () => void): () => void {
  deletedFilterListeners.add(listener);
  window.addEventListener('storage', listener);

  return () => {
    deletedFilterListeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

function readStoredIsDeletedShown(page: CatalogPage): boolean {
  try {
    const storedFilter = deletedFilterSchema.safeParse(localStorage.getItem(readStorageKey(page)));
    const isDeletedShown = !storedFilter.success || storedFilter.data === DELETED_ON;

    return isDeletedShown;
  } catch {
    return true;
  }
}

export function useStoredIsDeletedShown(page: CatalogPage): boolean {
  const isStoredDeletedShown = useSyncExternalStore(subscribe, () =>
    readStoredIsDeletedShown(page),
  );
  return isStoredDeletedShown;
}

export function storeIsDeletedShown({
  page,
  isDeletedShown,
}: Readonly<{ page: CatalogPage; isDeletedShown: boolean }>): void {
  try {
    localStorage.setItem(readStorageKey(page), isDeletedShown ? DELETED_ON : DELETED_OFF);
  } catch {
    return;
  }

  deletedFilterListeners.forEach((listener) => {
    listener();
  });
}

export function readIsDeletedShown({
  searchParams,
  isStoredDeletedShown,
}: Readonly<{ searchParams: URLSearchParams; isStoredDeletedShown: boolean }>): boolean {
  const filterParam = deletedFilterSchema.safeParse(searchParams.get(DELETED_PARAM));
  const isDeletedShown = filterParam.success
    ? filterParam.data === DELETED_ON
    : isStoredDeletedShown;

  return isDeletedShown;
}

export function writeDeletedShown(searchParams: URLSearchParams): URLSearchParams {
  const nextSearchParams = new URLSearchParams(searchParams);
  nextSearchParams.set(DELETED_PARAM, DELETED_ON);

  return nextSearchParams;
}

export function writeIsDeletedShown({
  searchParams,
  isDeletedShown,
  isStoredDeletedShown,
}: Readonly<{
  searchParams: URLSearchParams;
  isDeletedShown: boolean;
  isStoredDeletedShown: boolean;
}>): URLSearchParams {
  const nextSearchParams = new URLSearchParams(searchParams);
  if (!isDeletedShown) {
    nextSearchParams.set(DELETED_PARAM, DELETED_OFF);
  } else if (isStoredDeletedShown) {
    nextSearchParams.delete(DELETED_PARAM);
  } else {
    nextSearchParams.set(DELETED_PARAM, DELETED_ON);
  }

  return nextSearchParams;
}
