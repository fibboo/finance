const SCROLLABLE_OVERFLOWS = new Set(['auto', 'scroll']);

function readScrollContainer(element: HTMLElement): HTMLElement | undefined {
  let ancestor = element.parentElement;
  while (ancestor !== null && !SCROLLABLE_OVERFLOWS.has(getComputedStyle(ancestor).overflowX)) {
    ancestor = ancestor.parentElement;
  }

  return ancestor ?? undefined;
}

export function revealHorizontally(element: HTMLElement | null): void {
  const container = element === null ? undefined : readScrollContainer(element);
  if (element === null || container === undefined) {
    return;
  }

  const elementBounds = element.getBoundingClientRect();
  const containerBounds = container.getBoundingClientRect();
  const isFullyShown =
    elementBounds.left >= containerBounds.left && elementBounds.right <= containerBounds.right;
  if (!isFullyShown) {
    const scrollMargin = Number.parseFloat(getComputedStyle(element).scrollMarginLeft);
    container.scrollTo({
      left:
        container.scrollLeft +
        elementBounds.left -
        containerBounds.left -
        (Number.isNaN(scrollMargin) ? 0 : scrollMargin),
    });
  }
}
