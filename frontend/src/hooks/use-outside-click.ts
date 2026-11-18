import { useEffect, useEffectEvent } from 'react';

type UseOutsideClickParams = Readonly<{
  isActive: boolean;
  readIsInside: (target: Node) => boolean;
  readIsOutsideClickAllowed?: (target: Node) => boolean;
  onOutsideClick: () => void;
}>;

export function useOutsideClick({
  isActive,
  readIsInside,
  readIsOutsideClickAllowed,
  onOutsideClick,
}: UseOutsideClickParams): void {
  const readIsOutside = useEffectEvent((target: EventTarget | null): boolean => {
    const isOutside = target instanceof Node && !readIsInside(target);
    return isOutside;
  });
  const reportOutsideClick = useEffectEvent(() => {
    onOutsideClick();
  });
  const readIsClickAllowed = useEffectEvent((target: EventTarget | null): boolean => {
    const isAllowed = target instanceof Node && readIsOutsideClickAllowed?.(target) === true;
    return isAllowed;
  });

  useEffect(() => {
    if (!isActive) {
      return undefined;
    }

    let isPressedOutside = false;

    function handlePointerDown(event: PointerEvent) {
      const isOutside = readIsOutside(event.target);
      const isPrimaryButton = event.button === 0;
      isPressedOutside = isOutside && isPrimaryButton;
      if (isPressedOutside && !readIsClickAllowed(event.target)) {
        event.preventDefault();
        event.stopPropagation();
      }
      if (isOutside && !isPrimaryButton) {
        reportOutsideClick();
      }
    }

    function handlePointerCancel() {
      isPressedOutside = false;
    }

    function handleClick(event: MouseEvent) {
      const isOutsideClick = isPressedOutside && readIsOutside(event.target);
      isPressedOutside = false;
      if (isOutsideClick) {
        if (!readIsClickAllowed(event.target)) {
          event.preventDefault();
          event.stopPropagation();
        }
        reportOutsideClick();
      }
    }

    document.addEventListener('pointerdown', handlePointerDown, { capture: true });
    document.addEventListener('pointercancel', handlePointerCancel, { capture: true });
    document.addEventListener('click', handleClick, { capture: true });

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, { capture: true });
      document.removeEventListener('pointercancel', handlePointerCancel, { capture: true });
      document.removeEventListener('click', handleClick, { capture: true });
    };
  }, [isActive]);
}
