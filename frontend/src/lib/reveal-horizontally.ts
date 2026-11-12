const SCROLLABLE_OVERFLOWS = new Set(['auto', 'scroll']);

function readScrollContainer(element: HTMLElement): HTMLElement | undefined {
  let ancestor = element.parentElement;
  while (ancestor !== null && !SCROLLABLE_OVERFLOWS.has(getComputedStyle(ancestor).overflowX)) {
    ancestor = ancestor.parentElement;
  }

  return ancestor ?? undefined;
}

function readPixels(value: string): number {
  const pixels = Number.parseFloat(value);
  const knownPixels = Number.isNaN(pixels) ? 0 : pixels;
  return knownPixels;
}

export function revealHorizontally(element: HTMLElement | null): void {
  const container = element === null ? undefined : readScrollContainer(element);
  if (element === null || container === undefined) {
    return;
  }

  const elementBounds = element.getBoundingClientRect();
  const containerBounds = container.getBoundingClientRect();
  const elementStyle = getComputedStyle(element);
  const scrollMarginLeft = readPixels(elementStyle.scrollMarginLeft);
  const scrollMarginRight = readPixels(elementStyle.scrollMarginRight);
  const isFullyShown =
    elementBounds.left - scrollMarginLeft >= containerBounds.left &&
    elementBounds.right + scrollMarginRight <= containerBounds.right;
  if (!isFullyShown) {
    container.scrollTo({
      left: container.scrollLeft + elementBounds.left - containerBounds.left - scrollMarginLeft,
    });
  }
}
