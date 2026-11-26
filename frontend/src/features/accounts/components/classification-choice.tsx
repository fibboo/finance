import type { UseFormRegisterReturn } from 'react-hook-form';

import { LoadError } from '@/components/load-error/load-error';
import { SelectField } from '@/components/select-field/select-field';
import { Skeleton } from '@/components/skeleton/skeleton';

import type { Classification } from '../api/classification-queries';
import styles from './classification-settings.module.css';

type ClassificationChoiceProps = Readonly<{
  classifications: readonly Classification[] | undefined;
  isError: boolean;
  registration: UseFormRegisterReturn;
  onRetry: () => void;
}>;

export function ClassificationChoice({
  classifications,
  isError,
  registration,
  onRetry,
}: ClassificationChoiceProps) {
  if (classifications === undefined) {
    return isError ? (
      <LoadError message="Could not load types." onRetry={onRetry} />
    ) : (
      <Skeleton className={styles['fieldSkeleton']} />
    );
  }

  if (classifications.length < 2) {
    return null;
  }

  return (
    <SelectField
      label="Type"
      registration={registration}
      options={classifications.map(({ id, name }) => ({ value: id, label: name }))}
    />
  );
}
