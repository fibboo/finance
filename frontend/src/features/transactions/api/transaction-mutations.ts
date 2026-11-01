import { hashKey, mutationOptions, type QueryClient, type QueryKey } from '@tanstack/react-query';

import { apiClient, readData } from '@/lib/api-client';
import { ApiError } from '@/lib/api-error';
import type { components } from '@/lib/api-schema';

import { transactionQueries } from './transaction-queries';

type Transaction = components['schemas']['Transaction'];
type AdjustmentRequest = components['schemas']['AdjustmentRequest'];
type ErrorCode = components['schemas']['ErrorCodeType'];

const BASE_CURRENCY_AMOUNT_MESSAGES: Partial<Record<ErrorCode, string>> = {
  NO_ACCOUNT_BASE_CURRENCY_RATE:
    'The account had no rate on this date, so enter the amount in the base currency',
  BASE_CURRENCY_AMOUNT_NOT_ALLOWED:
    'The account had a rate on this date, so leave the amount in the base currency empty',
};

async function postAdjustment({
  account_id,
  ...body
}: Readonly<AdjustmentRequest & { account_id: string }>): Promise<Transaction> {
  try {
    const adjustment = readData(
      await apiClient.POST('/accounting/accounts/{account_id}/adjustment', {
        params: { path: { account_id } },
        body,
      }),
    );
    return adjustment;
  } catch (error) {
    const baseCurrencyAmountMessage =
      error instanceof ApiError && error.error_code !== null
        ? BASE_CURRENCY_AMOUNT_MESSAGES[error.error_code]
        : undefined;
    if (error instanceof ApiError && baseCurrencyAmountMessage !== undefined) {
      throw new ApiError({
        status: error.status,
        message: error.message,
        error_code: error.error_code,
        fieldErrors: [{ field: 'base_currency_amount', message: baseCurrencyAmountMessage }],
      });
    }

    throw error;
  }
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
