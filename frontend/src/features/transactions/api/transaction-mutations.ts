import { hashKey, mutationOptions, type QueryClient, type QueryKey } from '@tanstack/react-query';

import { apiClient, readData } from '@/lib/api-client';
import type { components } from '@/lib/api-schema';

import { transactionQueries } from './transaction-queries';

type Transaction = components['schemas']['Transaction'];
type AdjustmentRequest = components['schemas']['AdjustmentRequest'];

async function postAdjustment({
  account_id,
  ...body
}: Readonly<AdjustmentRequest & { account_id: string }>): Promise<Transaction> {
  const adjustment = readData(
    await apiClient.POST('/accounting/accounts/{account_id}/adjustment', {
      params: { path: { account_id } },
      body,
    }),
  );
  return adjustment;
}

function invalidateFeeds({
  client,
  relatedQueryKeys,
}: Readonly<{ client: QueryClient; relatedQueryKeys: readonly QueryKey[] }>): Promise<unknown> {
  const invalidation = Promise.all(
    [transactionQueries.feeds().queryKey, ...relatedQueryKeys].map((queryKey) =>
      client.invalidateQueries({ queryKey }),
    ),
  );
  return invalidation;
}

async function deleteTransaction(
  transaction: Readonly<Pick<Transaction, 'id' | 'transaction_type'>>,
): Promise<Transaction> {
  const deletedTransaction = readData(
    await apiClient.DELETE('/accounting/transactions/{transaction_id}', {
      params: {
        path: { transaction_id: transaction.id },
        query: { transaction_type: transaction.transaction_type },
      },
    }),
  );
  return deletedTransaction;
}

export const transactionMutations = {
  delete(relatedQueryKeys: readonly QueryKey[]) {
    return mutationOptions({
      mutationFn: deleteTransaction,
      onSuccess: async (_deletedTransaction, transaction, _onMutateResult, { client }) => {
        const deletedDetailHash = hashKey(transactionQueries.detail(transaction.id).queryKey);
        await Promise.all([
          client.invalidateQueries({
            queryKey: transactionQueries.details().queryKey,
            predicate: (query) => query.queryHash !== deletedDetailHash,
            refetchType: 'none',
          }),
          invalidateFeeds({ client, relatedQueryKeys }),
        ]);
      },
    });
  },
  adjust(relatedQueryKeys: readonly QueryKey[]) {
    return mutationOptions({
      mutationFn: postAdjustment,
      onSuccess: (_adjustment, _request, _onMutateResult, { client }) =>
        invalidateFeeds({ client, relatedQueryKeys }),
    });
  },
};
