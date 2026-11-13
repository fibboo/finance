import { z } from 'zod';

export type CatalogPage = 'categories' | 'income_sources' | 'locations';

const DELETED_PARAM = 'deleted';
const DELETED_ON = 'on';
const DELETED_OFF = 'off';

const deletedFilterSchema = z.enum([DELETED_ON, DELETED_OFF]);

function readStorageKey(page: CatalogPage): string {
  const storageKey = `deleted:${page}`;
  return storageKey;
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

function storeIsDeletedShown({
  page,
  isDeletedShown,
}: Readonly<{ page: CatalogPage; isDeletedShown: boolean }>): void {
  try {
    localStorage.setItem(readStorageKey(page), isDeletedShown ? DELETED_ON : DELETED_OFF);
  } catch {
    return;
  }
}

export function readIsDeletedShown({
  searchParams,
  page,
}: Readonly<{ searchParams: URLSearchParams; page: CatalogPage }>): boolean {
  const filterParam = deletedFilterSchema.safeParse(searchParams.get(DELETED_PARAM));
  const isDeletedShown = filterParam.success
    ? filterParam.data === DELETED_ON
    : readStoredIsDeletedShown(page);

  return isDeletedShown;
}

export function writeIsDeletedShown({
  searchParams,
  page,
  isDeletedShown,
}: Readonly<{
  searchParams: URLSearchParams;
  page: CatalogPage;
  isDeletedShown: boolean;
}>): URLSearchParams {
  const isStoredDeletedShown = readStoredIsDeletedShown(page);
  storeIsDeletedShown({ page, isDeletedShown });
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
