import { useState } from 'react';

type DateJump = Readonly<{
  anchorDate: string | undefined;
  jumpToDate: (jump: Readonly<{ date: string; listKey: string }>) => void;
  clearJump: () => void;
}>;

export function useDateJump(listKey: string): DateJump {
  const [jump, setJump] = useState<Readonly<{ date: string; listKey: string }>>();
  const anchorDate = jump?.listKey === listKey ? jump.date : undefined;
  return {
    anchorDate,
    jumpToDate: setJump,
    clearJump: () => {
      setJump(undefined);
    },
  };
}
