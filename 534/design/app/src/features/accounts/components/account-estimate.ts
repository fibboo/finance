import type { components } from '@/lib/api-schema';

type Account = components['schemas']['Account'];

export function readEstimatedBaseBalance(account: Readonly<Account>): number | null {
  const estimatedBaseBalance =
    account.estimated_base_balance === null || account.estimated_base_balance === undefined
      ? null
      : Number(account.estimated_base_balance);
  return estimatedBaseBalance;
}
