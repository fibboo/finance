import { useSyncExternalStore } from 'react';

const DESKTOP_MEDIA_QUERY = '(width >= 64rem)';

function subscribeToDesktop(onChange: () => void): () => void {
  const desktopMedia = window.matchMedia(DESKTOP_MEDIA_QUERY);
  desktopMedia.addEventListener('change', onChange);
  return () => {
    desktopMedia.removeEventListener('change', onChange);
  };
}

function readIsDesktop(): boolean {
  const isDesktop = window.matchMedia(DESKTOP_MEDIA_QUERY).matches;
  return isDesktop;
}

export function useIsDesktop(): boolean {
  const isDesktop = useSyncExternalStore(subscribeToDesktop, readIsDesktop);
  return isDesktop;
}
