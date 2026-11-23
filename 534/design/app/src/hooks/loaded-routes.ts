const loadedPathnames = new Set<string>();
const listeners = new Set<() => void>();

export function markRouteLoaded(pathname: string): void {
  loadedPathnames.add(pathname);
  listeners.forEach((listener) => {
    listener();
  });
}

export function isRouteLoaded(pathname: string): boolean {
  return loadedPathnames.has(pathname);
}

export function subscribeToLoadedRoutes(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
