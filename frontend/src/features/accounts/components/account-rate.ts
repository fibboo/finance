import type { components } from '@/lib/api-schema';
import { formatRate } from '@/lib/format-money';

type Account = components['schemas']['Account'];

export function readAccountRateText({
  account,
  baseCurrency,
}: Readonly<{ account: Readonly<Account>; baseCurrency: string }>): string | undefined {
  const rate = Number(account.base_currency_rate);
  const rateText = account.currency === baseCurrency || rate === 0 ? undefined : formatRate(rate);
  return rateText;
}
