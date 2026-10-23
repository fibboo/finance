import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { type ReactNode, useId, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';

import { Skeleton } from '@/components/skeleton/skeleton';
import { listSkeletonKeys } from '@/components/skeleton/skeleton-keys';
import type { components } from '@/lib/api-schema';
import { ApiError } from '@/lib/api-error';

import { userMutations } from '../api/user-mutations';
import { baseCurrencyFormSchema } from '../schemas/base-currency-form';
import styles from './base-currency-form.module.css';

type DictionaryItem = components['schemas']['DictionaryItem'];
type BaseCurrencyFormInput = z.input<typeof baseCurrencyFormSchema>;
type BaseCurrencyFormOutput = z.output<typeof baseCurrencyFormSchema>;

type BaseCurrencyFormProps = Readonly<{
  currencies: readonly DictionaryItem[] | undefined;
  copy: ReactNode;
  note: ReactNode;
}>;

const SKELETON_CURRENCY_COUNT = 6;

export function BaseCurrencyForm({ copy, currencies, note }: BaseCurrencyFormProps) {
  const [search, setSearch] = useState('');
  const errorId = useId();
  const { control, register, handleSubmit, setError, formState } = useForm<
    BaseCurrencyFormInput,
    unknown,
    BaseCurrencyFormOutput
  >({ resolver: zodResolver(baseCurrencyFormSchema), defaultValues: { base_currency: '' } });
  const pickedCurrency = useWatch({ control, name: 'base_currency' });
  const setBaseCurrency = useMutation(userMutations.setBaseCurrency());
  const searchText = search.trim().toLowerCase();
  const shownCurrencies = (currencies ?? []).filter(
    (currency) =>
      currency.key.toLowerCase().includes(searchText) ||
      currency.label.toLowerCase().includes(searchText),
  );
  const currencyError = formState.errors.base_currency?.message;
  const requestError = formState.errors.root?.['server']?.message;

  return (
    <form
      className={styles['baseCurrencyForm']}
      noValidate
      onSubmit={(event) => {
        void handleSubmit((values) => {
          setBaseCurrency.mutate(values, {
            onError: (error) => {
              if (error instanceof ApiError) {
                error.fieldErrors.forEach((fieldError) => {
                  setError(fieldError.field === 'base_currency' ? 'base_currency' : 'root.server', {
                    message: fieldError.message,
                  });
                });
              }
            },
          });
        })(event);
      }}
    >
      <div className={styles['copy']}>
        {copy}
        <div className={styles['note']}>{note}</div>
      </div>
      <div className={styles['formPanel']}>
        <div className={styles['panel']} aria-busy={currencies === undefined}>
          {currencies === undefined ? (
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
                <legend className="visually-hidden">Base currency</legend>
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
        {currencies === undefined ? (
          <Skeleton className={styles['startSkeleton']} />
        ) : (
          <button type="submit" className={styles['start']} disabled={setBaseCurrency.isPending}>
            {pickedCurrency === '' ? 'Start' : `Start with ${pickedCurrency}`}
          </button>
        )}
      </div>
    </form>
  );
}
