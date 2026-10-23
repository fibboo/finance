import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { type ReactNode, useId, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';

import { Skeleton } from '@/components/skeleton/skeleton';
import { listSkeletonKeys } from '@/components/skeleton/skeleton-keys';
import type { components } from '@/lib/api-schema';
import { ApiError } from '@/lib/api-error';

import { userMutations } from '../api/user-mutations';
import { userQueries } from '../api/user-queries';
import { createBaseCurrencyFormSchema } from '../schemas/base-currency-form';
import styles from './base-currency-form.module.css';
import { UsernameField } from './username-field';

type DictionaryItem = components['schemas']['DictionaryItem'];
type BaseCurrencyFormSchema = ReturnType<typeof createBaseCurrencyFormSchema>;
type BaseCurrencyFormInput = z.input<BaseCurrencyFormSchema>;
type BaseCurrencyFormOutput = z.output<BaseCurrencyFormSchema>;

type BaseCurrencyFormProps = Readonly<{
  currencies: readonly DictionaryItem[] | undefined;
  copy: ReactNode;
}>;

const SKELETON_CURRENCY_COUNT = 6;

export function BaseCurrencyForm({ copy, currencies }: BaseCurrencyFormProps) {
  const [search, setSearch] = useState('');
  const errorId = useId();
  const { data: user } = useQuery(userQueries.me());
  const givenUsername = user?.username ?? '';
  const { control, register, handleSubmit, setError, formState } = useForm<
    BaseCurrencyFormInput,
    unknown,
    BaseCurrencyFormOutput
  >({
    resolver: zodResolver(createBaseCurrencyFormSchema({ givenUsername })),
    values: { username: givenUsername, base_currency: '' },
    resetOptions: { keepDirtyValues: true },
  });
  const pickedCurrency = useWatch({ control, name: 'base_currency' });
  const setUsername = useMutation(userMutations.setUsername());
  const setBaseCurrency = useMutation(userMutations.setBaseCurrency());
  const isLoading = currencies === undefined || user === undefined;
  const isSaving = setUsername.isPending || setBaseCurrency.isPending;
  const searchText = search.trim().toLowerCase();
  const shownCurrencies = (currencies ?? []).filter(
    (currency) =>
      currency.key.toLowerCase().includes(searchText) ||
      currency.label.toLowerCase().includes(searchText),
  );
  const currencyError = formState.errors.base_currency?.message;
  const requestError = formState.errors.root?.['server']?.message;

  function showFieldErrors(error: Error) {
    if (error instanceof ApiError) {
      error.fieldErrors.forEach((fieldError) => {
        setError(
          fieldError.field === 'username' || fieldError.field === 'base_currency'
            ? fieldError.field
            : 'root.server',
          { message: fieldError.message },
        );
      });
    }
  }

  return (
    <form
      className={styles['baseCurrencyForm']}
      noValidate
      onSubmit={(event) => {
        void handleSubmit(async (values) => {
          if (values.username !== givenUsername) {
            const isUsernameSet = await setUsername.mutateAsync({ username: values.username }).then(
              () => true,
              (error: unknown) => {
                if (error instanceof Error) {
                  showFieldErrors(error);
                }
                return false;
              },
            );
            if (!isUsernameSet) {
              return;
            }
          }

          setBaseCurrency.mutate(
            { base_currency: values.base_currency },
            { onError: showFieldErrors },
          );
        })(event);
      }}
    >
      <div className={styles['copy']}>{copy}</div>
      <div className={styles['formPanel']}>
        <div className={styles['usernamePanel']} aria-busy={isLoading}>
          {isLoading ? (
            <Skeleton className={styles['usernameSkeleton']} />
          ) : (
            <UsernameField
              registration={register('username')}
              description="How you appear in finance. You can change it later."
              error={formState.errors.username?.message}
            />
          )}
        </div>
        <div className={styles['panel']} aria-busy={isLoading}>
          <div className={styles['currencyHeader']}>
            <h2 className={styles['currencyTitle']}>Main currency</h2>
            <p className={styles['currencyText']}>
              Your totals and monthly summaries are shown in it, and your first Wallet opens in it.
            </p>
            <p className={styles['note']}>
              <svg className={styles['noteIcon']} aria-hidden="true" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v5M12 16.5v.5" />
              </svg>
              You can’t change it later. Accounts in other currencies can be added any time.
            </p>
          </div>
          {isLoading ? (
            <>
              <Skeleton className={styles['searchSkeleton']} />
              <div className={styles['currencies']}>
                {listSkeletonKeys(SKELETON_CURRENCY_COUNT).map((key) => (
                  <span key={key} className={styles['currencySkeleton']}>
                    <Skeleton className={styles['codeSkeleton']} />
                    <Skeleton className={styles['nameSkeleton']} />
                  </span>
                ))}
              </div>
            </>
          ) : (
            <>
              <label className={styles['search']}>
                <svg className={styles['searchIcon']} aria-hidden="true" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                <span className="visually-hidden">Search currency</span>
                <input
                  type="search"
                  className={styles['searchInput']}
                  placeholder="Code or name"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                  }}
                />
              </label>
              <fieldset
                className={styles['currencies']}
                aria-describedby={currencyError === undefined ? undefined : errorId}
              >
                <legend className="visually-hidden">Main currency</legend>
                {shownCurrencies.map((currency) => (
                  <label key={currency.key} className={styles['currency']}>
                    <input
                      type="radio"
                      className={styles['radio']}
                      value={currency.key}
                      {...register('base_currency')}
                    />
                    <span className={styles['code']}>{currency.key}</span>{' '}
                    <span className={styles['name']}>{currency.label}</span>
                    <svg className={styles['check']} aria-hidden="true" viewBox="0 0 24 24">
                      <path d="m5 12 4.5 4.5L19 7" />
                    </svg>
                  </label>
                ))}
                {shownCurrencies.length === 0 && (
                  <p className={styles['empty']}>No currency matches the search.</p>
                )}
              </fieldset>
            </>
          )}
        </div>
        {currencyError !== undefined && (
          <p id={errorId} className={styles['error']} role="alert">
            {currencyError}
          </p>
        )}
        {requestError !== undefined && (
          <p className={styles['error']} role="alert">
            {requestError}
          </p>
        )}
        {isLoading ? (
          <Skeleton className={styles['startSkeleton']} />
        ) : (
          <button type="submit" className={styles['start']} disabled={isSaving}>
            {pickedCurrency === '' ? 'Start' : `Start with ${pickedCurrency}`}
          </button>
        )}
      </div>
    </form>
  );
}
