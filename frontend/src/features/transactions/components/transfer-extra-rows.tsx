import { useFormContext } from 'react-hook-form';

import type { components } from '@/lib/api-schema';

import type { MovementFormValues } from '../schemas/transaction-form';
import { readAmountInputProps } from './amount-input';
import { InputRow } from './input-row';
import styles from './transaction-form.module.css';

type MovementRequest = components['schemas']['MovementRequest'];

type TransferExtraRowsProps = Readonly<{
  destinationCurrency: string | undefined;
  isDestinationAmountAsked: boolean;
}>;

export function TransferExtraRows({
  destinationCurrency,
  isDestinationAmountAsked,
}: TransferExtraRowsProps) {
  const { register, formState } = useFormContext<MovementFormValues, unknown, MovementRequest>();
  if (!isDestinationAmountAsked) {
    return null;
  }

  return (
    <div className={[styles['rows'], styles['extraRows']].join(' ')}>
      <InputRow
        label="Amount received"
        input={readAmountInputProps({
          registration: register('destination_amount'),
          isNegativeAllowed: false,
        })}
        suffix={destinationCurrency}
        error={formState.errors.destination_amount?.message}
      />
    </div>
  );
}
