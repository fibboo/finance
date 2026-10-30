import { mutationOptions, type QueryKey } from '@tanstack/react-query';

import { apiClient, readData } from '@/lib/api-client';
import type { components } from '@/lib/api-schema';

import { transactionQueries } from './transaction-queries';

type Transaction = components['schemas']['Transaction'];

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
      onSuccess: (_deletedTransaction, _transaction, _onMutateResult, { client }) =>
        Promise.all(
          [transactionQueries.feeds().queryKey, ...relatedQueryKeys].map((queryKey) =>
            client.invalidateQueries({ queryKey }),
          ),
        ),
    });
  },
};
