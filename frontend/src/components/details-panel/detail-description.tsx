import { useEffect, useId, useRef, useState } from 'react';

import styles from './detail-description.module.css';

type DetailDescriptionProps = Readonly<{
  description: string;
}>;

export function DetailDescription({ description }: DetailDescriptionProps) {
  const id = useId();
  const anchorName = `--detail-description-${id.replaceAll(':', '')}`;
  const paragraphRef = useRef<HTMLParagraphElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const disclosureRef = useRef<HTMLSpanElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    const text = textRef.current;
    if (text === null || typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    function measure() {
      if (text !== null) {
        setIsTruncated(text.scrollWidth > text.clientWidth);
      }
    }

    const observer = new ResizeObserver(measure);
    observer.observe(text);
    document.fonts.addEventListener('loadingdone', measure);
    return () => {
      observer.disconnect();
      document.fonts.removeEventListener('loadingdone', measure);
    };
  }, [description]);

  useEffect(() => {
    if (!isTruncated) {
      return undefined;
    }

    function dismissOnEscape(event: KeyboardEvent) {
      const disclosure = disclosureRef.current;
      if (event.key === 'Escape' && disclosure?.matches(':popover-open') === true) {
        event.preventDefault();
        event.stopPropagation();
        disclosure.hidePopover();
      }
    }

    function dismissOnBlur(event: FocusEvent) {
      const nextFocus = event.relatedTarget;
      if (!(nextFocus instanceof Node) || paragraphRef.current?.contains(nextFocus) !== true) {
        disclosureRef.current?.hidePopover();
      }
    }

    const paragraph = paragraphRef.current;
    paragraph?.addEventListener('focusout', dismissOnBlur);
    window.addEventListener('keydown', dismissOnEscape, { capture: true });
    return () => {
      paragraph?.removeEventListener('focusout', dismissOnBlur);
      window.removeEventListener('keydown', dismissOnEscape, { capture: true });
    };
  }, [isTruncated]);

  return (
    <p
      ref={paragraphRef}
      className={styles['description']}
      style={{ anchorName }}
      onPointerLeave={(event) => {
        const focused = document.activeElement;
        const hasKeyboardFocus =
          event.currentTarget.contains(focused) && focused?.matches(':focus-visible') === true;
        if (event.pointerType === 'mouse' && !hasKeyboardFocus) {
          disclosureRef.current?.hidePopover();
        }
      }}
    >
      <span ref={textRef} className={styles['text']} aria-hidden={isTruncated}>
        {description}
      </span>
      {isTruncated && (
        <>
          <button
            type="button"
            className={styles['trigger']}
            aria-label={description}
            popoverTarget={id}
            onPointerEnter={(event) => {
              if (event.pointerType === 'mouse' && event.buttons === 0) {
                disclosureRef.current?.showPopover({ source: event.currentTarget });
              }
            }}
            onFocus={(event) => {
              if (
                event.relatedTarget !== disclosureRef.current &&
                event.currentTarget.matches(':focus-visible')
              ) {
                disclosureRef.current?.showPopover({ source: event.currentTarget });
              }
            }}
            onKeyDown={(event) => {
              const disclosure = disclosureRef.current;
              if (
                event.key === 'Tab' &&
                !event.shiftKey &&
                disclosure?.matches(':popover-open') === true &&
                disclosure.scrollHeight > disclosure.clientHeight
              ) {
                event.preventDefault();
                disclosure.focus({ preventScroll: true });
              }
            }}
          />
          <span
            id={id}
            ref={disclosureRef}
            popover="auto"
            role="region"
            aria-label="Full description"
            tabIndex={-1}
            className={styles['disclosure']}
            style={{ positionAnchor: anchorName }}
          >
            {description}
          </span>
        </>
      )}
    </p>
  );
}
