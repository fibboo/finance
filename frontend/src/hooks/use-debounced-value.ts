import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const TYPING_PAUSE_MS = 300;

export function useDebouncedAction(action: () => void): () => void {
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const currentAction = useRef(action);
  useLayoutEffect(() => {
    currentAction.current = action;
  });
  useEffect(
    () => () => {
      clearTimeout(timeout.current);
    },
    [],
  );
  function schedule() {
    clearTimeout(timeout.current);
    timeout.current = setTimeout(() => {
      currentAction.current();
    }, TYPING_PAUSE_MS);
  }
  return schedule;
}

export function useDebouncedValue<Value>(value: Value): Value {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedValue(value);
    }, TYPING_PAUSE_MS);
    return () => {
      clearTimeout(timeoutId);
    };
  }, [value]);
  return debouncedValue;
}
