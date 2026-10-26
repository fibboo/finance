import { useState } from 'react';

const MAX_PAGE_SIZE = 100;

function readPageSize(): number {
  const rootStyle = getComputedStyle(document.documentElement);
  const rowHeight =
    Number.parseFloat(rootStyle.getPropertyValue('--size-transaction-row')) *
    Number.parseFloat(rootStyle.fontSize);
  if (!(rowHeight > 0)) {
    throw new Error('The transaction row height is not set.');
  }

  const pageSize = Math.min(MAX_PAGE_SIZE, Math.ceil(window.innerHeight / rowHeight));
  return pageSize;
}

export function usePageSize(): number {
  const [pageSize] = useState(readPageSize);
  return pageSize;
}
