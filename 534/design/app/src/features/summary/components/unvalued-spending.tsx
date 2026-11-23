import { EstimatedAmount } from '@/components/estimated-amount/estimated-amount';
import type { components } from '@/lib/api-schema';
import { formatMoney } from '@/lib/format-money';

import styles from './unvalued-spending.module.css';

type CurrencyAmount = components['schemas']['CurrencyAmount'];

const CURRENCY_AMOUNT_SEPARATOR = ' · ';

type UnvaluedSpendingProps = Readonly<{
  unvaluedSpent: readonly CurrencyAmount[];
  estimatedUnvaluedSpent: string | null;
  baseCurrency: string;
}>;

export function UnvaluedSpending({
  unvaluedSpent,
  estimatedUnvaluedSpent,
  baseCurrency,
}: UnvaluedSpendingProps) {
  const currencyAmounts = unvaluedSpent
    .map((currencyAmount) =>
      formatMoney({ amount: Number(currencyAmount.amount), currency: currencyAmount.currency }),
    )
    .join(CURRENCY_AMOUNT_SEPARATOR);
  return (
    <div className={styles['unvaluedSpending']}>
      <span className={styles['label']}>Unvalued spending</span>
      <span className={styles['estimate']}>
        {estimatedUnvaluedSpent === null ? (
          'No estimate available'
        ) : (
          <EstimatedAmount
            amount={-Number(estimatedUnvaluedSpent)}
            currency={baseCurrency}
            signDisplay="exceptZero"
          />
        )}
      </span>
      <span className={styles['currencyAmounts']}>{currencyAmounts}</span>
      {estimatedUnvaluedSpent === null && (
        <p className={styles['hint']}>Not included in Spent or Left. Estimates are unavailable.</p>
      )}
    </div>
  );
}
