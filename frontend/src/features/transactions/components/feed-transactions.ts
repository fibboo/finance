import type { components } from '@/lib/api-schema';

import type { TransactionFeedQuery } from '../hooks/use-transaction-feed';

type TransactionPage = components['schemas']['Page_Transaction_'];
type Transaction = components['schemas']['Transaction'];

type FeedTransactions = Readonly<{
  newerTransactions: readonly Transaction[];
  olderTransactions: readonly Transaction[];
  transactions: readonly Transaction[];
}>;

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

export function readFeedTransactions(feed: TransactionFeedQuery): FeedTransactions {
  const { data, isPlaceholderData } = feed.query;
  const newerTransactions = isPlaceholderData
    ? []
    : readNewerTransactions(feed.newerQuery?.data?.pages);
  const olderTransactions = data === undefined ? [] : data.pages.flatMap((page) => page.items);
  const feedTransactions = {
    newerTransactions,
    olderTransactions,
    transactions: mergeTransactions([...newerTransactions, ...olderTransactions]),
  };
  return feedTransactions;
}

export function readTopTransactionId(feed: TransactionFeedQuery): string | undefined {
  const topTransactionId = feed.query.data?.pages[0]?.items[0]?.id;
  return topTransactionId;
}
