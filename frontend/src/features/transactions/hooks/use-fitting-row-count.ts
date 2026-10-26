import { useState } from 'react';

function countFittingRows(box: Element): number {
  const boxBottom = box.getBoundingClientRect().bottom;
  const fittingRowCount = [...box.querySelectorAll('li')].filter(
    (row) => row.getBoundingClientRect().bottom <= boxBottom,
  ).length;
  return fittingRowCount;
}

export function useFittingRowCount(): Readonly<{
  ref: (box: HTMLElement | null) => (() => void) | undefined;
  count: number;
}> {
  const [count, setCount] = useState(Number.POSITIVE_INFINITY);

  function ref(box: HTMLElement | null) {
    if (box === null) {
      return undefined;
    }

    const observer = new ResizeObserver(() => {
      setCount(countFittingRows(box));
    });
    observer.observe(box);
    return () => {
      observer.disconnect();
    };
  }

  return { ref, count };
}
