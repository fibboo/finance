import { useEffect, useState } from 'react';

const TYPING_PAUSE_MS = 300;

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
