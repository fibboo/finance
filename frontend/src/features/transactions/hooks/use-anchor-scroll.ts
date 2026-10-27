import { type RefObject, useLayoutEffect, useRef } from 'react';

type AnchorScrollOptions = Readonly<{
  rowsRef: RefObject<HTMLDivElement | null>;
  isAnchorReady: boolean;
  anchorDayDate: string | undefined;
  newerTransactionCount: number;
  transactionCount: number;
}>;

export function useAnchorScroll({
  rowsRef,
  isAnchorReady,
  anchorDayDate,
  newerTransactionCount,
  transactionCount,
}: AnchorScrollOptions): void {
  const scrollHeightRef = useRef(0);
  const newerCountRef = useRef(0);
  const isAnchorScrolledRef = useRef(false);

  useLayoutEffect(() => {
    const rows = rowsRef.current;
    if (rows === null) {
      return;
    }

    if (isAnchorScrolledRef.current && newerTransactionCount > newerCountRef.current) {
      rows.scrollBy({ top: rows.scrollHeight - scrollHeightRef.current, behavior: 'instant' });
    }

    if (!isAnchorScrolledRef.current && isAnchorReady) {
      const anchorDay =
        anchorDayDate === undefined
          ? null
          : rows.querySelector(`[data-transaction-date="${anchorDayDate}"]`);
      if (anchorDay === null) {
        rows.scrollTo({ top: rows.scrollHeight, behavior: 'instant' });
      } else {
        anchorDay.scrollIntoView({ block: 'start', behavior: 'instant' });
      }

      isAnchorScrolledRef.current = true;
    }

    newerCountRef.current = newerTransactionCount;
    scrollHeightRef.current = rows.scrollHeight;
  }, [rowsRef, isAnchorReady, anchorDayDate, newerTransactionCount, transactionCount]);
}
