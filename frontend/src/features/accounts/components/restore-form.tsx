import { zodResolver } from '@hookform/resolvers/zod';
import type { QueryKey } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';

import { EntityForm } from '@/components/entity-form/entity-form';
import { TextField } from '@/components/text-field/text-field';
import type { components } from '@/lib/api-schema';

import { useAccountNameTaken } from '../hooks/use-account-name-taken';
import { useAccountRestore } from '../hooks/use-account-restore';
import {
  NAME_MAX_LENGTH,
  type RestoreFormOutput,
  restoreFormSchema,
  type RestoreFormValues,
} from '../schemas/account-form';

type Account = components['schemas']['Account'];

type RestoredEntityName = 'category' | 'income source';

type RestoreFormProps = Readonly<{
  account: Readonly<Account>;
  entityName: RestoredEntityName;
  relatedQueryKeys: readonly QueryKey[];
  onRestored: () => void;
  onBack: () => void;
}>;

export function RestoreForm({
  account,
  entityName,
  relatedQueryKeys,
  onRestored,
  onBack,
}: RestoreFormProps) {
  const { control, register, handleSubmit, setError, formState } = useForm<
    RestoreFormValues,
    unknown,
    RestoreFormOutput
  >({
    resolver: zodResolver(restoreFormSchema),
    defaultValues: { name: account.name },
  });
  const name = useWatch({ control, name: 'name' });
  const { isNameTaken, isLookupPending, nameTakenMessage } = useAccountNameTaken({
    name,
    kind: account.kind,
    ownAccountId: account.id,
    unchangedName: undefined,
  });
  const accountRestore = useAccountRestore({
    relatedQueryKeys,
    onRestored,
    onNameTaken: () => {
      setError('name', { message: nameTakenMessage });
    },
    onFieldError: ({ field, message }) => {
      setError(field === 'name' ? 'name' : 'root.server', { message });
    },
  });

  return (
    <EntityForm
      title={`Restore ${entityName}`}
      submitLabel={`Restore ${entityName}`}
      isSubmitDisabled={isNameTaken || isLookupPending || accountRestore.isPending}
      error={formState.errors.root?.['server']?.message}
      onBack={onBack}
      onSubmit={(event) => {
        void handleSubmit(({ name }) => {
          accountRestore.restore({ account_id: account.id, name });
        })(event);
      }}
    >
      <TextField
        label="Name"
        registration={register('name')}
        placeholder={undefined}
        maxLength={NAME_MAX_LENGTH}
        isOptional={false}
        isMultiline={false}
        error={formState.errors.name?.message ?? (isNameTaken ? nameTakenMessage : undefined)}
      />
    </EntityForm>
  );
}
