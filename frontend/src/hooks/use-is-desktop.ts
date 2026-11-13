import { useSyncExternalStore } from 'react';

type MediaStore = Readonly<{
  subscribe: (onChange: () => void) => () => void;
  readIsMatched: () => boolean;
}>;

function createMediaStore(query: string): MediaStore {
  function subscribe(onChange: () => void): () => void {
    const media = window.matchMedia(query);
    media.addEventListener('change', onChange);
    return () => {
      media.removeEventListener('change', onChange);
    };
  }

  function readIsMatched(): boolean {
    const isMatched = window.matchMedia(query).matches;
    return isMatched;
  }

  const mediaStore = { subscribe, readIsMatched };
  return mediaStore;
}

const DESKTOP_MEDIA = createMediaStore('(min-width: 64rem)');
const WIDE_DESKTOP_MEDIA = createMediaStore('(min-width: 76.75rem)');

export function useIsDesktop(): boolean {
  const isDesktop = useSyncExternalStore(DESKTOP_MEDIA.subscribe, DESKTOP_MEDIA.readIsMatched);
  return isDesktop;
}

export function useIsWideDesktop(): boolean {
  const isWideDesktop = useSyncExternalStore(
    WIDE_DESKTOP_MEDIA.subscribe,
    WIDE_DESKTOP_MEDIA.readIsMatched,
  );
  return isWideDesktop;
}
