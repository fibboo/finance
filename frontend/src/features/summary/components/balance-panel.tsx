import { useQuery } from '@tanstack/react-query';

import { Skeleton } from '@/components/skeleton/skeleton';
import { formatMoney } from '@/lib/format-money';

import { summaryQueries } from '../api/summary-queries';
import styles from './balance-panel.module.css';

type BalancePanelProps = Readonly<{ baseCurrency: string }>;

const SKELETON_TILES = ['earned', 'spent', 'left-over'];

export function BalancePanel({ baseCurrency }: BalancePanelProps) {
  const { data: summary, isPending } = useQuery(summaryQueries.current());
  if (isPending) {
    return (
      <section className={styles['balancePanel']} aria-label="Balance" aria-busy="true">
        <p className={styles['totalSkeleton']}>
          <Skeleton className={styles['totalLabelSkeleton']} />
          <Skeleton className={styles['totalAmountSkeleton']} />
        </p>
        <div className={styles['month']}>
          <span className={styles['monthLabel']}>This month</span>
          <div className={styles['tiles']}>
            {SKELETON_TILES.map((tile) => (
              <div key={tile} className={styles['tileSkeleton']}>
                <Skeleton className={styles['tileLabelSkeleton']} />
                <Skeleton className={styles['tileAmountSkeleton']} />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (summary === undefined) {
    return null;
  }

  const earned = Number(summary.earned);
  const tiles = [
    { label: 'Earned', amount: earned, isAccent: earned > 0 },
    { label: 'Spent', amount: -Number(summary.spent), isAccent: false },
    { label: 'Left over', amount: Number(summary.left_over), isAccent: false },
  ];
  return (
    <section className={styles['balancePanel']} aria-label="Balance">
      <p className={styles['total']}>
        <span className={styles['totalLabel']}>Total balance · {baseCurrency}</span>
        <span className={styles['totalAmount']}>
          {formatMoney({ amount: Number(summary.total_balance), currency: baseCurrency })}
        </span>
      </p>
      <div className={styles['month']}>
        <span className={styles['monthLabel']}>This month</span>
        <dl className={styles['tiles']}>
          {tiles.map((tile) => (
            <div key={tile.label} className={styles['tile']}>
              <dt className={styles['tileLabel']}>{tile.label}</dt>
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
      </div>
    </section>
  );
}
