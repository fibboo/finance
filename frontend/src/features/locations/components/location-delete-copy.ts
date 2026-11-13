export const LOCATION_DELETE_TITLE = 'Delete this location?';

export function readLocationDeleteText(name: string): string {
  const deleteText = `${name}. It leaves your locations and the pickers, and its past transactions keep showing it.`;
  return deleteText;
}
