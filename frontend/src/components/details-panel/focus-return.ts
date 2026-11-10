const DETAILS_SELECTOR = '[data-details]';

export function focusReturnTarget(targetId: string): void {
  const target = document.getElementById(targetId);
  if (target !== null) {
    target.focus();
    return;
  }

  requestAnimationFrame(() => {
    const shownDetails = [...document.querySelectorAll<HTMLElement>(DETAILS_SELECTOR)].find(
      (details) => details.getBoundingClientRect().height > 0,
    );
    shownDetails?.focus({ preventScroll: true });
  });
}
