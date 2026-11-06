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
  deepestY: number;
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
  distance,
  height,
  releaseTime,
}: Readonly<{
  drag: Readonly<Drag>;
  distance: number;
  height: number;
  releaseTime: number;
}>): boolean {
  const isStill = releaseTime - drag.lastTime > STILL_TIME;
  const isFlickDown = !isStill && drag.speed > FLICK_SPEED && distance > FLICK_MIN_DISTANCE;
  const isFlickUp =
    !isStill && drag.speed < -FLICK_SPEED && drag.deepestY - drag.lastY > FLICK_MIN_DISTANCE;
  const isCloseRelease = (distance > height * CLOSE_SHARE_OF_HEIGHT && !isFlickUp) || isFlickDown;
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

  function slideAway({ sheet, distance }: Readonly<{ sheet: HTMLElement; distance: number }>) {
    const offScreenDistance = distance + window.innerHeight - sheet.getBoundingClientRect().top;
    delete sheet.dataset['dragging'];
    sheet.dataset['slidingAway'] = '';
    sheet.style.transform = `translateY(${String(offScreenDistance)}px)`;
    const hasTransition = Number.parseFloat(getComputedStyle(sheet).transitionDuration) > 0;
    if (!hasTransition || offScreenDistance <= distance) {
      onClose();
      return;
    }

    function closeAfterSlide(event: TransitionEvent) {
      if (event.target !== sheet) {
        return;
      }

      sheet.removeEventListener('transitionend', closeAfterSlide);
      sheet.removeEventListener('transitioncancel', closeAfterSlide);
      if (sheet.isConnected && getComputedStyle(sheet).display !== 'none') {
        onClose();
      }
    }
    sheet.addEventListener('transitionend', closeAfterSlide);
    sheet.addEventListener('transitioncancel', closeAfterSlide);
  }

  return {
    onPointerDown: (event) => {
      const isFree = dragRef.current === null && !('slidingAway' in event.currentTarget.dataset);
      if (isFree && isDragStart({ event, handle: handleRef.current })) {
        dragRef.current = {
          pointerId: event.pointerId,
          startY: event.clientY,
          lastY: event.clientY,
          deepestY: event.clientY,
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
      drag.deepestY = Math.max(drag.deepestY, event.clientY);
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
      const distance = readDragDistance(drag);
      const height = sheet.offsetHeight;
      if (isCloseRelease({ drag, distance, height, releaseTime: event.timeStamp })) {
        slideAway({ sheet, distance });
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
