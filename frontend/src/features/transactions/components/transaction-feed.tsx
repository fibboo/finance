import { type ReactNode, useRef } from 'react';

import { LoadError } from '@/components/load-error/load-error';
import type { components } from '@/lib/api-schema';

import { useAnchorScroll } from '../hooks/use-anchor-scroll';
import type { TransactionFeedQuery } from '../hooks/use-transaction-feed';
import { BackToTop } from './back-to-top';
import { NoTransactions } from './no-transactions';
import styles from './transaction-feed.module.css';
import { TransactionDayList } from './transaction-day-list';
import { TransactionSkeletonRows } from './transaction-skeleton-rows';

type TransactionPage = components['schemas']['Page_Transaction_'];
type Transaction = components['schemas']['Transaction'];
type DictionaryItem = components['schemas']['DictionaryItem'];

const LOADING_MORE_ROW_COUNT = 2;
const NEXT_PAGE_MARGIN = '0% 0% 50% 0%';
const NEWER_PAGE_MARGIN = '50% 0% 0% 0%';

function mergeTransactions(transactions: readonly Transaction[]): readonly Transaction[] {
  const seenIds = new Set<string>();
  const mergedTransactions: Transaction[] = [];
  for (const transaction of transactions) {
    if (!seenIds.has(transaction.id)) {
      seenIds.add(transaction.id);
      mergedTransactions.push(transaction);
    }
  }

  return mergedTransactions;
}

function readNewerTransactions(
  pages: readonly TransactionPage[] | undefined,
): readonly Transaction[] {
  const newerTransactions = (pages ?? []).flatMap((page) => page.items).reverse();
  return newerTransactions;
}

function observeEdge({
  edge,
  rootMargin,
  onReached,
}: Readonly<{ edge: HTMLDivElement | null; rootMargin: string; onReached: () => void }>) {
  if (edge === null) {
    return undefined;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        onReached();
      }
    },
    { root: edge.parentElement, rootMargin },
  );
  observer.observe(edge);
  return () => {
    observer.disconnect();
  };
}

type TransactionFeedProps = Readonly<{
  feed: TransactionFeedQuery;
  baseCurrency: string;
  transactionTypes: readonly DictionaryItem[] | undefined;
  label: string;
  header?: ReactNode;
  isGroupedByDay?: boolean;
  emptyState?: ReactNode;
  onReturnToToday?: () => void;
}>;

export function TransactionFeed({
  feed,
  baseCurrency,
  transactionTypes,
  label,
  header,
  isGroupedByDay = true,
  emptyState = <NoTransactions />,
  onReturnToToday,
}: TransactionFeedProps) {
  const { query, newerQuery, anchorDate, pageSize, isScrolledDown, setIsScrolledDown } = feed;
  const rowsRef = useRef<HTMLDivElement>(null);
  const {
    data,
    isPending,
    isFetching,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    isPlaceholderData,
    fetchNextPage,
  } = query;
  const newerTransactions = isPlaceholderData ? [] : readNewerTransactions(newerQuery?.data?.pages);
  const olderTransactions = data === undefined ? [] : data.pages.flatMap((page) => page.items);
  const transactions = mergeTransactions([...newerTransactions, ...olderTransactions]);
  useAnchorScroll({
    rowsRef,
    isAnchorReady: anchorDate !== undefined && data !== undefined && !isPlaceholderData,
    anchorDayDate: olderTransactions[0]?.transaction_date,
    newerTransactionCount: newerTransactions.length,
    transactionCount: transactions.length,
  });
  const isNewerFailed = newerQuery !== undefined && !isPlaceholderData && newerQuery.isError;
  const canLoadNewer =
    newerQuery !== undefined &&
    !isPlaceholderData &&
    newerQuery.hasNextPage &&
    !newerQuery.isFetching &&
    !newerQuery.isError;
  return (
    <section
      aria-label={label}
      aria-busy={
        isPending || isFetchingNextPage || isPlaceholderData || transactionTypes === undefined
      }
      className={styles['transactions']}
    >
      {header}
      <div
        ref={rowsRef}
        className={isPlaceholderData ? styles['staleRows'] : styles['rows']}
        onScroll={(event) => {
          setIsScrolledDown(event.currentTarget.scrollTop > 0);
        }}
      >
        {data === undefined || transactionTypes === undefined ? (
          <TransactionSkeletonRows count={pageSize} />
        ) : transactions.length > 0 ? (
          <>
            {isNewerFailed && (
              <LoadError
                message="Couldn't load newer"
                onRetry={() => {
                  void (newerQuery.data === undefined
                    ? newerQuery.refetch()
                    : newerQuery.fetchNextPage());
                }}
              />
            )}
            {canLoadNewer && (
              <div
                ref={(edge) =>
                  observeEdge({
                    edge,
                    rootMargin: NEWER_PAGE_MARGIN,
                    onReached: () => {
                      void newerQuery.fetchNextPage();
                    },
                  })
                }
              />
            )}
            <TransactionDayList
              transactions={transactions}
              baseCurrency={baseCurrency}
              transactionTypes={transactionTypes}
              isGroupedByDay={isGroupedByDay}
            />
            {isFetchingNextPage && <TransactionSkeletonRows count={LOADING_MORE_ROW_COUNT} />}
            {hasNextPage && !isFetchingNextPage && isFetchNextPageError && (
              <LoadError
                message="Couldn't load more"
                onRetry={() => {
                  void fetchNextPage();
                }}
              />
            )}
            {hasNextPage && !isFetchNextPageError && !isPlaceholderData && (
              <div
                ref={(edge) =>
                  observeEdge({
                    edge,
                    rootMargin: NEXT_PAGE_MARGIN,
                    onReached: () => {
                      if (!isFetching) {
                        void fetchNextPage();
                      }
                    },
                  })
                }
              />
            )}
          </>
        ) : (
          emptyState
        )}
      </div>
      {isScrolledDown && (
        <BackToTop
          onClick={() => {
            if (anchorDate !== undefined && onReturnToToday !== undefined) {
              onReturnToToday();
            } else {
              rowsRef.current?.scrollTo({ top: 0 });
            }
          }}
        />
      )}
    </section>
  );
}
