import { type RefCallback, useState } from 'react';

const FULLY_IN_VIEW = 0.99;

type StripEdges = Readonly<{
  observeFirst: RefCallback<Element>;
  observeLast: RefCallback<Element>;
  isFirstInView: boolean;
  isLastInView: boolean;
}>;

function observeInStrip({
  item,
  onChange,
}: Readonly<{ item: Element; onChange: (isInView: boolean) => void }>): () => void {
  const observer = new IntersectionObserver(
    (entries) => {
      onChange(entries.some((entry) => entry.intersectionRatio >= FULLY_IN_VIEW));
    },
    { root: item.parentElement, threshold: [FULLY_IN_VIEW] },
  );
  observer.observe(item);
  return () => {
    observer.disconnect();
  };
}

export function useStripEdges(): StripEdges {
  const [isFirstInView, setIsFirstInView] = useState(true);
  const [isLastInView, setIsLastInView] = useState(true);

  function observeFirst(item: Element) {
    return observeInStrip({ item, onChange: setIsFirstInView });
  }

  function observeLast(item: Element) {
    return observeInStrip({ item, onChange: setIsLastInView });
  }

  return { observeFirst, observeLast, isFirstInView, isLastInView };
}
