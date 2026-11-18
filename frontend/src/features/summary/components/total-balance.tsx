import { useQuery } from '@tanstack/react-query';

import { EstimatedAmount } from '@/components/estimated-amount/estimated-amount';
import { Skeleton } from '@/components/skeleton/skeleton';
import { formatMoney } from '@/lib/format-money';

import { summaryQueries } from '../api/summary-queries';
import styles from './total-balance.module.css';

type TotalBalanceProps = Readonly<{ baseCurrency: string }>;

export function TotalBalance({ baseCurrency }: TotalBalanceProps) {
  const { data: summary, isPending } = useQuery(summaryQueries.current());
  if (!isPending && summary === undefined) {
    return null;
  }

  return summary === undefined ? (
    <p className={styles['totalBalanceSkeleton']}>
      <Skeleton className={styles['labelSkeleton']} />
      <Skeleton className={styles['amountSkeleton']} />
    </p>
  ) : (
    <p className={styles['totalBalance']}>
      <span className={styles['label']}>Total balance · {baseCurrency}</span>
      {summary.estimated_total_balance === null ? (
        <>
          <span className={styles['amount']}>
            {formatMoney({ amount: Number(summary.total_balance), currency: baseCurrency })}
          </span>
          <span className={styles['note']}>Valued amounts</span>
        </>
      ) : (
        <span className={styles['amount']}>
          <EstimatedAmount
            amount={Number(summary.estimated_total_balance)}
            currency={baseCurrency}
          />
        </span>
      )}
    </p>
  );
}
