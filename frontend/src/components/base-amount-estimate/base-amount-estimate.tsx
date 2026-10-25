import { formatMoney } from '@/lib/format-money';

import styles from './base-amount-estimate.module.css';

type BaseAmountEstimateProps = Readonly<{
  amount: number;
  currency: string;
  signDisplay?: Intl.NumberFormatOptions['signDisplay'];
}>;

export function BaseAmountEstimate({ amount, currency, signDisplay }: BaseAmountEstimateProps) {
  return (
    <span className={styles['baseAmountEstimate']}>
      {`≈ ${formatMoney({ amount, currency, signDisplay })}`}
    </span>
  );
}
