import { formatMoney } from '@/lib/format-money';

import styles from './estimated-amount.module.css';

type EstimatedAmountProps = Readonly<{
  amount: number;
  currency: string;
  signDisplay?: Intl.NumberFormatOptions['signDisplay'];
}>;

export function EstimatedAmount({ amount, currency, signDisplay = 'auto' }: EstimatedAmountProps) {
  return (
    <span className={styles['estimatedAmount']}>
      ≈ {formatMoney({ amount, currency, signDisplay })}
    </span>
  );
}
