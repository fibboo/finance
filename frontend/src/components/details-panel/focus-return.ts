const DETAILS_SELECTOR = '[data-details]';

function focusTarget(targetId: string): boolean {
  const target = document.getElementById(targetId);
  target?.focus();
  const isFocused = target !== null && document.activeElement === target;
  return isFocused;
}

export function focusReturnTarget(targetId: string): void {
  if (focusTarget(targetId)) {
    return;
  }

  requestAnimationFrame(() => {
    if (focusTarget(targetId)) {
      return;
    }

    const shownDetails = [...document.querySelectorAll<HTMLElement>(DETAILS_SELECTOR)].find(
      (details) => details.getBoundingClientRect().height > 0,
    );
    shownDetails?.focus({ preventScroll: true });
  });
}
