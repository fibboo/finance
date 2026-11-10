import type { components } from '@/lib/api-schema';

type AccountKind = components['schemas']['AccountKind'];

export const MONEY_ACCOUNT_KINDS = ['ASSET', 'LIABILITY'] as const satisfies readonly AccountKind[];

export type MoneyAccountKind = (typeof MONEY_ACCOUNT_KINDS)[number];

export function isMoneyAccountKind(kind: string): kind is MoneyAccountKind {
  const isMoneyKind = MONEY_ACCOUNT_KINDS.some((moneyKind) => moneyKind === kind);
  return isMoneyKind;
}
