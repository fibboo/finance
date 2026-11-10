import { MONEY_ACCOUNT_KINDS } from '@/lib/account-kinds';
import type { components } from '@/lib/api-schema';

type Account = components['schemas']['Account'];
type MoneyAccountKind = (typeof MONEY_ACCOUNT_KINDS)[number];
type GroupAccount = Account & Readonly<{ currency: string }>;

type AccountGroup = Readonly<{
  kind: MoneyAccountKind;
  accounts: readonly GroupAccount[];
}>;

export function readAccountGroups(accounts: readonly Account[]): readonly AccountGroup[] {
  const accountGroups = MONEY_ACCOUNT_KINDS.map((kind) => ({
    kind,
    accounts: accounts.flatMap((account) =>
      account.kind === kind && account.currency !== null
        ? [{ ...account, currency: account.currency }]
        : [],
    ),
  })).filter((group) => group.accounts.length > 0);
  return accountGroups;
}
