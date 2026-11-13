import { readNeighbourLinkId } from '@/lib/neighbour-link';

const ROW_LINK_ID_PREFIX = 'catalog-row-link-';
const DELETE_BUTTON_ID_PREFIX = 'catalog-row-delete-';

export function readCatalogRowLinkId(entryId: string): string {
  const linkId = `${ROW_LINK_ID_PREFIX}${entryId}`;
  return linkId;
}

export function readCatalogDeleteButtonId(entryId: string): string {
  const buttonId = `${DELETE_BUTTON_ID_PREFIX}${entryId}`;
  return buttonId;
}

export function readNeighbourCatalogRowLinkId(entryId: string): string | undefined {
  const neighbourLinkId = readNeighbourLinkId({
    linkIdPrefix: ROW_LINK_ID_PREFIX,
    linkId: readCatalogRowLinkId(entryId),
  });
  return neighbourLinkId;
}
