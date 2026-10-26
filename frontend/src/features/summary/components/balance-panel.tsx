import { useQuery } from '@tanstack/react-query';

import { Skeleton } from '@/components/skeleton/skeleton';
import { formatMoney, LOCALE } from '@/lib/format-money';

import { summaryQueries } from '../api/summary-queries';
import styles from './balance-panel.module.css';

function readMonthName({
  month,
  width,
}: Readonly<{ month: string; width: 'long' | 'short' }>): string {
  const monthName = new Intl.DateTimeFormat(LOCALE, { month: width, timeZone: 'UTC' }).format(
    new Date(`${month}T00:00:00Z`),
  );
  return monthName;
}

type BalancePanelProps = Readonly<{ baseCurrency: string }>;

export function BalancePanel({ baseCurrency }: BalancePanelProps) {
  const { data: summary, isPending } = useQuery(summaryQueries.current());
  if (!isPending && summary === undefined) {
    return null;
  }

  const earned = Number(summary?.earned);
  const tiles = [
    { label: 'Earned', amount: earned, isAccent: earned > 0, hasMonth: true },
    { label: 'Spent', amount: -Number(summary?.spent), isAccent: false, hasMonth: false },
    { label: 'Left', amount: Number(summary?.left_over), isAccent: false, hasMonth: false },
  ];
  return (
    <section className={styles['balancePanel']} aria-label="Balance" aria-busy={isPending}>
      {summary === undefined ? (
        <p className={styles['totalSkeleton']}>
          <Skeleton className={styles['totalLabelSkeleton']} />
          <Skeleton className={styles['totalAmountSkeleton']} />
        </p>
      ) : (
        <p className={styles['total']}>
          <span className={styles['totalLabel']}>Total balance · {baseCurrency}</span>
          <span className={styles['totalAmount']}>
            {formatMoney({ amount: Number(summary.total_balance), currency: baseCurrency })}
          </span>
        </p>
      )}
      <div className={styles['month']}>
        {summary === undefined ? (
          <Skeleton className={styles['monthLabelSkeleton']} />
        ) : (
          <span className={styles['monthLabel']}>
            {readMonthName({ month: summary.month, width: 'long' })}
          </span>
        )}
        {summary === undefined ? (
          <div className={styles['tiles']}>
            {tiles.map((tile) => (
              <div key={tile.label} className={styles['tileSkeleton']}>
                <Skeleton className={styles['tileLabelSkeleton']} />
                <Skeleton className={styles['tileAmountSkeleton']} />
              </div>
            ))}
          </div>
        ) : (
          <dl className={styles['tiles']}>
            {tiles.map((tile) => (
              <div key={tile.label} className={styles['tile']}>
                <dt className={styles['tileLabel']}>
                  {tile.label}
                  {tile.hasMonth && (
                    <span className={styles['tileMonth']}>
                      {' · '}
                      {readMonthName({ month: summary.month, width: 'short' })}
                    </span>
                  )}
                </dt>
                <dd className={tile.isAccent ? styles['tileAccent'] : styles['tileAmount']}>
                  {formatMoney({
                    amount: tile.amount,
                    currency: baseCurrency,
                    signDisplay: 'exceptZero',
                  })}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}
