import { useQuery } from '@tanstack/react-query';

import { EstimatedAmount } from '@/components/estimated-amount/estimated-amount';
import { Skeleton } from '@/components/skeleton/skeleton';
import { formatMoney } from '@/lib/format-money';

import { summaryQueries } from '../api/summary-queries';
import styles from './total-balance.module.css';

const MIN_TWO_DECIMAL_RATE = 0.01;
const SMALL_RATE_SIGNIFICANT_DIGITS = 15;
const ESTIMATE_RATE_NOTICE = 'Unknown account rates use public market data.';

type TotalBalanceProps = Readonly<{ baseCurrency: string }>;

export function TotalBalance({ baseCurrency }: TotalBalanceProps) {
  const { data: summary, isPending } = useQuery(summaryQueries.current());
  if (!isPending && summary === undefined) {
    return null;
  }

  const estimateRates = summary?.estimate_rates ?? [];
  return summary === undefined ? (
    <p className={styles['totalBalanceSkeleton']}>
      <Skeleton className={styles['labelSkeleton']} />
      <Skeleton className={styles['amountSkeleton']} />
    </p>
  ) : (
    <div className={styles['balanceWithRates']}>
      <p className={styles['totalBalance']}>
        <span className={styles['label']}>Total balance · {baseCurrency}</span>
        {summary.estimated_total_balance === null ? (
          <span className={styles['amount']}>
            {formatMoney({ amount: Number(summary.total_balance), currency: baseCurrency })}
          </span>
        ) : (
          <span className={styles['amount']}>
            <EstimatedAmount
              amount={Number(summary.estimated_total_balance)}
              currency={baseCurrency}
              isMuted={false}
            />
          </span>
        )}
      </p>
      {estimateRates.length > 0 && (
        <div className={styles['rates']}>
          <ul className={styles['rateList']} aria-label="Applied exchange rates">
            {estimateRates.map(({ currency, rate }) => {
              const amount = Number(rate);
              const rateText = formatMoney({
                amount,
                currency: baseCurrency,
                maximumSignificantDigits:
                  amount > 0 && amount < MIN_TWO_DECIMAL_RATE
                    ? SMALL_RATE_SIGNIFICANT_DIGITS
                    : undefined,
              });
              return (
                <li key={currency}>
                  1 {currency} = {rateText}
                </li>
              );
            })}
          </ul>
          <details className={styles['rateNotice']}>
            <summary
              className={styles['rateNoticeText']}
              title={ESTIMATE_RATE_NOTICE}
              onBlur={(event) => {
                const notice = event.currentTarget.closest('details');
                if (notice !== null && !notice.contains(event.relatedTarget)) {
                  notice.open = false;
                }
              }}
              onKeyDown={(event) => {
                const notice = event.currentTarget.closest('details');
                if (event.key === 'Escape' && notice !== null) {
                  notice.open = false;
                }
              }}
              onClick={(event) => {
                if (event.currentTarget.scrollWidth <= event.currentTarget.clientWidth) {
                  event.preventDefault();
                }
              }}
            >
              {ESTIMATE_RATE_NOTICE}
            </summary>
            <p className={styles['rateNoticeFull']}>{ESTIMATE_RATE_NOTICE}</p>
          </details>
        </div>
      )}
    </div>
  );
}
