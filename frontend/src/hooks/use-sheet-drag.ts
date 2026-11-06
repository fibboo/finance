import { type PointerEvent, type RefObject, useRef } from 'react';

const DRAG_AREA_SELECTOR = '[data-sheet-drag-area]';
const CLOSE_SHARE_OF_HEIGHT = 0.3;
const FLICK_SPEED = 0.5;
const FLICK_MIN_DISTANCE = 16;
const STILL_TIME = 100;

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
  const isDragStart =
    pointerType !== 'mouse' &&
    event.isPrimary &&
    target instanceof Element &&
    target.closest(DRAG_AREA_SELECTOR) !== null &&
    target.closest('button') === null &&
    handle !== null &&
    getComputedStyle(handle).display !== 'none';
  return isDragStart;
}

function readDragDistance(drag: Readonly<Drag>): number {
  const distance = Math.max(0, drag.lastY - drag.startY);
  return distance;
}

function isCloseRelease({
  drag,
  height,
  releaseTime,
}: Readonly<{ drag: Readonly<Drag>; height: number; releaseTime: number }>): boolean {
  const distance = readDragDistance(drag);
  const isStill = releaseTime - drag.lastTime > STILL_TIME;
  const isFlick = !isStill && drag.speed > FLICK_SPEED && distance > FLICK_MIN_DISTANCE;
  const isCloseRelease = distance > height * CLOSE_SHARE_OF_HEIGHT || isFlick;
  return isCloseRelease;
}

function springBack(sheet: HTMLElement) {
  delete sheet.dataset['dragging'];
  sheet.style.removeProperty('transform');
}

export function useSheetDrag({
  handleRef,
  onClose,
}: Readonly<{
  handleRef: RefObject<HTMLElement | null>;
  onClose: () => void;
}>): SheetDragHandlers {
  const dragRef = useRef<Drag | null>(null);
  const isSlidingAwayRef = useRef(false);

  function slideAway({ sheet, distance }: Readonly<{ sheet: HTMLElement; distance: number }>) {
    delete sheet.dataset['dragging'];
    sheet.style.transform = 'translateY(100%)';
    const hasTransition = Number.parseFloat(getComputedStyle(sheet).transitionDuration) > 0;
    if (!hasTransition || distance >= sheet.offsetHeight) {
      onClose();
      return;
    }

    isSlidingAwayRef.current = true;
    function closeAfterSlide(event: TransitionEvent) {
      if (event.target === sheet) {
        sheet.removeEventListener('transitionend', closeAfterSlide);
        sheet.removeEventListener('transitioncancel', closeAfterSlide);
        isSlidingAwayRef.current = false;
        onClose();
      }
    }
    sheet.addEventListener('transitionend', closeAfterSlide);
    sheet.addEventListener('transitioncancel', closeAfterSlide);
  }

  return {
    onPointerDown: (event) => {
      const isFree = dragRef.current === null && !isSlidingAwayRef.current;
      if (isFree && isDragStart({ event, handle: handleRef.current })) {
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
      const drag = dragRef.current;
      if (drag?.pointerId !== event.pointerId) {
        return;
      }

      dragRef.current = null;
      const sheet = event.currentTarget;
      if (isCloseRelease({ drag, height: sheet.offsetHeight, releaseTime: event.timeStamp })) {
        slideAway({ sheet, distance: readDragDistance(drag) });
        return;
      }

      springBack(sheet);
    },
    onPointerCancel: (event) => {
      if (dragRef.current?.pointerId === event.pointerId) {
        dragRef.current = null;
        springBack(event.currentTarget);
      }
    },
  };
}
