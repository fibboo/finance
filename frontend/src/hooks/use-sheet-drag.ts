import { type PointerEvent, type RefObject, useRef } from 'react';

const DRAG_AREA_SELECTOR = '[data-sheet-drag-area]';
const CLOSE_SHARE_OF_HEIGHT = 0.3;
const FLICK_SPEED = 0.5;

type Drag = {
  pointerId: number;
  startY: number;
  lastY: number;
  lastTime: number;
  speed: number;
};

type SheetDragHandlers = Readonly<{
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: PointerEvent<HTMLElement>) => void;
}>;

function isDragStart({
  event,
  handle,
}: Readonly<{ event: PointerEvent<HTMLElement>; handle: HTMLElement | null }>): boolean {
  const { target, pointerType } = event;
  const isInDragArea =
    target instanceof Element &&
    target.closest(DRAG_AREA_SELECTOR) !== null &&
    target.closest('button') === null;
  const isBottomSheet = handle !== null && getComputedStyle(handle).display !== 'none';
  const isDragStart = pointerType !== 'mouse' && event.isPrimary && isInDragArea && isBottomSheet;
  return isDragStart;
}

function readDragDistance(drag: Readonly<Drag>): number {
  const distance = Math.max(0, drag.lastY - drag.startY);
  return distance;
}

export function useSheetDrag({
  handleRef,
  onClose,
}: Readonly<{
  handleRef: RefObject<HTMLElement | null>;
  onClose: () => void;
}>): SheetDragHandlers {
  const dragRef = useRef<Drag | null>(null);

  function settle(sheet: HTMLElement) {
    const drag = dragRef.current;
    dragRef.current = null;
    delete sheet.dataset['dragging'];
    if (drag === null) {
      return;
    }

    const isClosing =
      readDragDistance(drag) > sheet.offsetHeight * CLOSE_SHARE_OF_HEIGHT ||
      drag.speed > FLICK_SPEED;
    if (!isClosing) {
      sheet.style.removeProperty('transform');
      return;
    }

    sheet.style.transform = 'translateY(100%)';
    const hasTransition = Number.parseFloat(getComputedStyle(sheet).transitionDuration) > 0;
    if (!hasTransition) {
      onClose();
      return;
    }

    sheet.addEventListener('transitionend', function closeAfterSlide(event) {
      if (event.target === sheet) {
        sheet.removeEventListener('transitionend', closeAfterSlide);
        onClose();
      }
    });
  }

  return {
    onPointerDown: (event) => {
      if (dragRef.current === null && isDragStart({ event, handle: handleRef.current })) {
        dragRef.current = {
          pointerId: event.pointerId,
          startY: event.clientY,
          lastY: event.clientY,
          lastTime: event.timeStamp,
          speed: 0,
        };
      }
    },
    onPointerMove: (event) => {
      const drag = dragRef.current;
      if (drag?.pointerId !== event.pointerId) {
        return;
      }

      const elapsed = event.timeStamp - drag.lastTime;
      drag.speed = elapsed > 0 ? (event.clientY - drag.lastY) / elapsed : 0;
      drag.lastY = event.clientY;
      drag.lastTime = event.timeStamp;
      const sheet = event.currentTarget;
      sheet.dataset['dragging'] = '';
      sheet.style.transform = `translateY(${String(readDragDistance(drag))}px)`;
    },
    onPointerUp: (event) => {
      if (dragRef.current?.pointerId === event.pointerId) {
        settle(event.currentTarget);
      }
    },
    onPointerCancel: (event) => {
      if (dragRef.current?.pointerId === event.pointerId) {
        dragRef.current = null;
        const sheet = event.currentTarget;
        delete sheet.dataset['dragging'];
        sheet.style.removeProperty('transform');
      }
    },
  };
}
