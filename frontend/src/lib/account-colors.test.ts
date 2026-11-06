import { expect, test } from 'vitest';

import { readMoneyAccountColor } from './account-colors';

test.each([
  { kind: 'ASSET', color: '#2E8C7A', dot: '#2E8C7A' },
  { kind: 'LIABILITY', color: null, dot: '#4D8FBF' },
  { kind: 'EXPENSE', color: null, dot: undefined },
  { kind: 'INCOME', color: null, dot: undefined },
  { kind: 'EQUITY', color: null, dot: undefined },
] as const)('gives a $kind account with color $color the dot $dot', ({ kind, color, dot }) => {
  // act
  const accountColor = readMoneyAccountColor({ kind, color });

  // assert
  expect(accountColor).toBe(dot);
});
