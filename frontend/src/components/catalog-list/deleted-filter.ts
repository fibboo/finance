const DELETED_PARAM = 'deleted';
const DELETED_OFF = 'off';

export function readIsDeletedShown(searchParams: URLSearchParams): boolean {
  const isDeletedShown = searchParams.get(DELETED_PARAM) !== DELETED_OFF;
  return isDeletedShown;
}

export function writeIsDeletedShown({
  searchParams,
  isDeletedShown,
}: Readonly<{ searchParams: URLSearchParams; isDeletedShown: boolean }>): URLSearchParams {
  const nextSearchParams = new URLSearchParams(searchParams);
  if (isDeletedShown) {
    nextSearchParams.delete(DELETED_PARAM);
  } else {
    nextSearchParams.set(DELETED_PARAM, DELETED_OFF);
  }

  return nextSearchParams;
}
