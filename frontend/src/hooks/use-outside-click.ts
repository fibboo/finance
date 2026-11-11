import { useEffect, useEffectEvent } from 'react';

type UseOutsideClickParams = Readonly<{
  isActive: boolean;
  readIsInside: (target: Node) => boolean;
  onOutsideClick: () => void;
}>;

export function useOutsideClick({
  isActive,
  readIsInside,
  onOutsideClick,
}: UseOutsideClickParams): void {
  const readIsOutside = useEffectEvent((target: EventTarget | null): boolean => {
    const isOutside = target instanceof Node && !readIsInside(target);
    return isOutside;
  });
  const reportOutsideClick = useEffectEvent(() => {
    onOutsideClick();
  });

  useEffect(() => {
    if (!isActive) {
      return undefined;
    }

    let isPressedOutside = false;

    function handlePointerDown(event: PointerEvent) {
      isPressedOutside = readIsOutside(event.target);
    }

    function handleClick(event: MouseEvent) {
      if (isPressedOutside && readIsOutside(event.target)) {
        event.preventDefault();
        event.stopPropagation();
        reportOutsideClick();
      }
    }

    document.addEventListener('pointerdown', handlePointerDown, { capture: true });
    document.addEventListener('click', handleClick, { capture: true });

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, { capture: true });
      document.removeEventListener('click', handleClick, { capture: true });
    };
  }, [isActive]);
}
