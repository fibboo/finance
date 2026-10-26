import { type RefCallback, useState } from 'react';

function countFittingCells(list: Element): number {
  const style = getComputedStyle(list);
  const cellCount =
    style.display === 'grid'
      ? Math.max(1, style.gridTemplateColumns.split(' ').filter((track) => track !== '').length)
      : Number.POSITIVE_INFINITY;
  return cellCount;
}

export function useFittingCount(): Readonly<{ ref: RefCallback<Element>; count: number }> {
  const [count, setCount] = useState(1);

  function ref(grid: Element) {
    function measure() {
      setCount(countFittingCells(grid));
    }

    measure();
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
    };
  }

  return { ref, count };
}
