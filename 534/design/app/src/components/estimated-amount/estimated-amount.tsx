import { formatMoney } from '@/lib/format-money';

import styles from './estimated-amount.module.css';

type EstimatedAmountProps = Readonly<{
  amount: number;
  currency: string;
  signDisplay?: Intl.NumberFormatOptions['signDisplay'];
  isMuted?: boolean;
}>;

export function EstimatedAmount({
  amount,
  currency,
  signDisplay = 'auto',
  isMuted = true,
}: EstimatedAmountProps) {
  return (
    <span className={isMuted ? styles['mutedAmount'] : styles['amount']}>
      ≈ {formatMoney({ amount, currency, signDisplay })}
    </span>
  );
}
