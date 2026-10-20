import { type RefCallback, useState } from 'react';

function countFittingRows(style: Readonly<CSSStyleDeclaration>): number {
  const maxHeight = Number.parseFloat(style.maxHeight);
  const rowCount = Number.isNaN(maxHeight)
    ? 1
    : Math.floor(maxHeight / Number.parseFloat(style.gridAutoRows));
  return rowCount;
}

function countFittingCells(grid: Element): number {
  const style = getComputedStyle(grid);
  const columnCount = style.gridTemplateColumns.split(' ').filter((track) => track !== '').length;
  const cellCount = Math.max(1, columnCount * countFittingRows(style));
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
