import { useSyncExternalStore } from 'react';

function readLocalToday(): string {
  const today = new Date();
  const localToday = [
    String(today.getFullYear()).padStart(4, '0'),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
  return localToday;
}

function readMillisecondsToMidnight(): number {
  const now = new Date();
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const millisecondsToMidnight = nextMidnight.getTime() - now.getTime();
  return millisecondsToMidnight;
}

function subscribeToDayChange(onDayChange: () => void): () => void {
  let timeoutId = setTimeout(handleMidnight, readMillisecondsToMidnight());
  function handleMidnight() {
    onDayChange();
    timeoutId = setTimeout(handleMidnight, readMillisecondsToMidnight());
  }

  document.addEventListener('visibilitychange', onDayChange);
  return () => {
    clearTimeout(timeoutId);
    document.removeEventListener('visibilitychange', onDayChange);
  };
}

export function useToday(): string {
  const today = useSyncExternalStore(subscribeToDayChange, readLocalToday);
  return today;
}
