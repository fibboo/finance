const listeners = new Set<() => void>();
let isErrorShown = false;

function setErrorShown(isShown: boolean): void {
  isErrorShown = isShown;
  listeners.forEach((listener) => {
    listener();
  });
}

export function showErrorNotification(): void {
  setErrorShown(true);
}

export function dismissErrorNotification(): void {
  setErrorShown(false);
}

export function subscribeToErrorNotification(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function readIsErrorShown(): boolean {
  return isErrorShown;
}
