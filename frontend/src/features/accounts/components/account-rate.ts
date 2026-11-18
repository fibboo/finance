import type { components } from '@/lib/api-schema';
import { formatRate } from '@/lib/format-money';

import { readEstimatedBaseBalance } from './account-estimate';

type Account = components['schemas']['Account'];

function readRate(account: Readonly<Account>): number {
  const estimatedBaseBalance = readEstimatedBaseBalance(account);
  const rate =
    estimatedBaseBalance === null || estimatedBaseBalance === 0
      ? Number(account.base_currency_rate)
      : Number(account.balance) / estimatedBaseBalance;
  return rate;
}

export function readAccountRateText({
  account,
  baseCurrency,
}: Readonly<{ account: Readonly<Account>; baseCurrency: string }>): string | undefined {
  const rate = readRate(account);
  const rateText = account.currency === baseCurrency || rate <= 0 ? undefined : formatRate(rate);
  return rateText;
}
