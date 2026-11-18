import { EstimatedAmount } from '@/components/estimated-amount/estimated-amount';
import type { components } from '@/lib/api-schema';
import { formatMoney } from '@/lib/format-money';

import styles from './account-balance.module.css';
import { readEstimatedBaseBalance } from './account-estimate';
import { readAccountRateText } from './account-rate';

type Account = components['schemas']['Account'];

type AccountBalanceProps = Readonly<{
  account: Readonly<Account>;
  baseCurrency: string;
  isInline: boolean;
}>;

export function AccountBalance({ account, baseCurrency, isInline }: AccountBalanceProps) {
  const estimatedBaseBalance = readEstimatedBaseBalance(account);
  const rateText = readAccountRateText({ account, baseCurrency });
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
        {estimatedBaseBalance === null ? (
          formatMoney({ amount: Number(account.base_currency_balance), currency: baseCurrency })
        ) : (
          <EstimatedAmount amount={estimatedBaseBalance} currency={baseCurrency} />
        )}
        {rateText !== undefined && ` · rate ${rateText}`}
      </span>
    </div>
  );
}
