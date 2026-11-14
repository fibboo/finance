import type { components } from '@/lib/api-schema';
import { formatMoney } from '@/lib/format-money';

import styles from './account-balance.module.css';
import { readAccountRateText } from './account-rate';

type Account = components['schemas']['Account'];

function readBaseBalanceText({
  account,
  baseCurrency,
}: Readonly<{ account: Readonly<Account>; baseCurrency: string }>): string {
  const baseBalance = formatMoney({
    amount: Number(account.base_currency_balance),
    currency: baseCurrency,
  });
  const rateText = readAccountRateText({ account, baseCurrency });
  const baseBalanceText =
    rateText === undefined ? baseBalance : `${baseBalance} · rate ${rateText}`;
  return baseBalanceText;
}

type AccountBalanceProps = Readonly<{
  account: Readonly<Account>;
  baseCurrency: string;
  isInline: boolean;
}>;

export function AccountBalance({ account, baseCurrency, isInline }: AccountBalanceProps) {
  return (
    <div className={isInline ? styles['inlineAmounts'] : styles['amounts']}>
      <span
        className={`${styles['balance'] ?? ''} ${Number(account.balance) < 0 ? (styles['debt'] ?? '') : ''}`}
      >
        {formatMoney({
          amount: Number(account.balance),
          currency: account.currency ?? baseCurrency,
        })}
      </span>
      <span className={styles['baseBalance']}>
        {readBaseBalanceText({ account, baseCurrency })}
      </span>
    </div>
  );
}
