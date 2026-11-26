import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { type KeyboardEvent, useId, useLayoutEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { DELETE_ICON_PATH, EDIT_ICON_PATH } from '@/components/action-button/action-icons';
import { EntityForm } from '@/components/entity-form/entity-form';
import { LoadError } from '@/components/load-error/load-error';
import { SelectField } from '@/components/select-field/select-field';
import { Sheet } from '@/components/sheet/sheet';
import { Skeleton } from '@/components/skeleton/skeleton';
import { TextField } from '@/components/text-field/text-field';
import { ApiError } from '@/lib/api-error';

import {
  type Classification,
  type ClassificationKind,
  classificationMutations,
  classificationQueries,
} from '../api/classification-queries';
import {
  classificationNameSchema,
  type ClassificationNameValues,
  classificationReplacementSchema,
  type ClassificationReplacementValues,
  NAME_MAX_LENGTH,
} from '../schemas/account-form';
import styles from './classification-settings.module.css';

const CHECK_ICON_PATH = 'm5 12 5 5 9-10';
const CLOSE_ICON_PATH = 'M6 6l12 12M18 6 6 18';

type ClassificationSettingsProps = Readonly<{
  kind: ClassificationKind;
}>;

type SettingsView =
  | Readonly<{ kind: 'list' }>
  | Readonly<{ kind: 'create' }>
  | Readonly<{ kind: 'rename' | 'remove'; id: string }>;

type TypeNameFormProps = Readonly<{
  kind: ClassificationKind;
  classification?: Classification;
  onBack: () => void;
  onSaved: () => void;
}>;

function TypeNameForm({ kind, classification, onBack, onSaved }: TypeNameFormProps) {
  const errorId = useId();
  const form = useForm<ClassificationNameValues>({
    resolver: zodResolver(classificationNameSchema),
    defaultValues: { name: classification?.name ?? '' },
  });
  const { setFocus } = form;
  useLayoutEffect(() => {
    if (classification !== undefined) {
      setFocus('name', { shouldSelect: true });
    }
  }, [classification, setFocus]);

  const create = useMutation(classificationMutations.create(kind));
  const rename = useMutation(classificationMutations.rename(kind));
  const isPending = create.isPending || rename.isPending;
  const nameError = form.formState.errors.name?.message;
  const serverError = form.formState.errors.root?.['server']?.message;

  function showError(error: Error) {
    if (error instanceof ApiError) {
      const fieldError = error.fieldErrors.find(({ field }) => field === 'name');
      if (fieldError !== undefined) {
        form.setError('name', { message: fieldError.message }, { shouldFocus: true });
        return;
      }
    }

    form.setError('root.server', { message: error.message });
  }

  const submit = form.handleSubmit((values) => {
    const callbacks = { onSuccess: onSaved, onError: showError };
    if (classification === undefined) {
      create.mutate(values, callbacks);
    } else {
      rename.mutate({ classification_id: classification.id, ...values }, callbacks);
    }
  });

  function cancelOnEscape(event: KeyboardEvent<HTMLInputElement | HTMLButtonElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (!isPending) onBack();
    }
  }

  if (classification === undefined) {
    return (
      <EntityForm
        title="New type"
        submitLabel="Create type"
        isSubmitDisabled={isPending}
        error={serverError}
        onBack={onBack}
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        <TextField
          label="Name"
          registration={form.register('name')}
          placeholder={undefined}
          maxLength={NAME_MAX_LENGTH}
          isOptional={false}
          isMultiline={false}
          error={nameError}
        />
      </EntityForm>
    );
  }

  return (
    <form
      className={styles['rename']}
      aria-label={`Rename ${classification.name}`}
      noValidate
      onSubmit={(event) => {
        void submit(event);
      }}
    >
      <div>
        <input
          {...form.register('name')}
          className={styles['renameField']}
          aria-label="Type name"
          aria-invalid={nameError !== undefined}
          aria-describedby={
            nameError !== undefined || serverError !== undefined ? errorId : undefined
          }
          maxLength={NAME_MAX_LENGTH}
          autoComplete="off"
          readOnly={isPending}
          onKeyDown={cancelOnEscape}
        />
        {classification.is_default && <span className={styles['defaultLabel']}>Default</span>}
        {(nameError ?? serverError) !== undefined && (
          <p id={errorId} role="alert" className={styles['fieldError']}>
            {nameError ?? serverError}
          </p>
        )}
      </div>
      <div className={styles['actions']}>
        <button
          type="submit"
          className={`${styles['rowAction'] ?? ''} ${styles['save'] ?? ''}`}
          aria-label="Save name"
          title="Save name"
          onKeyDown={cancelOnEscape}
          disabled={isPending}
        >
          <svg className={styles['icon']} aria-hidden="true" viewBox="0 0 24 24">
            <path d={CHECK_ICON_PATH} />
          </svg>
        </button>
        <button
          type="button"
          className={styles['rowAction']}
          aria-label="Cancel editing"
          title="Cancel editing"
          onKeyDown={cancelOnEscape}
          disabled={isPending}
          onClick={onBack}
        >
          <svg className={styles['icon']} aria-hidden="true" viewBox="0 0 24 24">
            <path d={CLOSE_ICON_PATH} />
          </svg>
        </button>
      </div>
    </form>
  );
}

type RemoveTypeFormProps = Readonly<{
  kind: ClassificationKind;
  classification: Classification;
  classifications: readonly Classification[];
  onBack: () => void;
  onRemoved: () => void;
}>;

function RemoveTypeForm({
  kind,
  classification,
  classifications,
  onBack,
  onRemoved,
}: RemoveTypeFormProps) {
  const form = useForm<ClassificationReplacementValues>({
    resolver: zodResolver(classificationReplacementSchema),
    defaultValues: { replacement_id: '' },
  });
  const [isReplacementRequired, setIsReplacementRequired] = useState(classification.is_default);
  const replacementId = useWatch({ control: form.control, name: 'replacement_id' });
  const remove = useMutation(classificationMutations.delete(kind));
  const options = classifications
    .filter(({ id }) => id !== classification.id)
    .map(({ id, name }) => ({ value: id, label: name }));
  const isReplacementChosen = options.some(({ value }) => value === replacementId);
  const entityNames = kind === 'MONEY_ACCOUNT' ? 'accounts' : 'categories';

  return (
    <EntityForm
      title="Remove type"
      submitLabel="Remove type"
      isSubmitDisabled={remove.isPending || (isReplacementRequired && !isReplacementChosen)}
      error={form.formState.errors.root?.['server']?.message}
      onBack={onBack}
      onSubmit={(event) => {
        void form.handleSubmit(() => {
          remove.mutate(
            {
              classification_id: classification.id,
              replacement_id: isReplacementChosen ? replacementId : undefined,
            },
            {
              onSuccess: onRemoved,
              onError: (error) => {
                if (
                  error instanceof ApiError &&
                  error.error_code === 'CLASSIFICATION_REPLACEMENT_REQUIRED'
                ) {
                  setIsReplacementRequired(true);
                  form.setError('replacement_id', {
                    message: `This type is in use. Choose where to move its ${entityNames}.`,
                  });
                } else {
                  form.setError('root.server', { message: error.message });
                }
              },
            },
          );
        })(event);
      }}
    >
      <p>Remove “{classification.name}”?</p>
      <SelectField
        label={`Move ${entityNames} to`}
        registration={form.register('replacement_id')}
        error={form.formState.errors.replacement_id?.message}
        options={[
          { value: '', label: isReplacementRequired ? 'Choose a type' : 'Choose a type if needed' },
          ...options,
        ]}
      />
      {classification.is_default && <p>The replacement will become the default type.</p>}
    </EntityForm>
  );
}

function ClassificationSheet({
  kind,
  onClose,
}: ClassificationSettingsProps & Readonly<{ onClose: () => void }>) {
  const query = useQuery(classificationQueries.list(kind));
  const [view, setView] = useState<SettingsView>({ kind: 'list' });
  const focusId = useRef<string | undefined>(undefined);
  const listId = useId();
  const title = kind === 'MONEY_ACCOUNT' ? 'Account types' : 'Category types';
  const activeClassification =
    view.kind === 'rename' || view.kind === 'remove'
      ? query.data?.find(({ id }) => id === view.id)
      : undefined;

  useLayoutEffect(() => {
    const id = focusId.current;
    if (id !== undefined) {
      document.getElementById(`${listId}-${id}`)?.focus();
      focusId.current = undefined;
    }
  });

  function showList(id?: string) {
    focusId.current = id;
    setView({ kind: 'list' });
  }

  return (
    <Sheet label={title} onClose={onClose}>
      {view.kind === 'create' ? (
        <TypeNameForm
          kind={kind}
          onBack={() => {
            showList();
          }}
          onSaved={() => {
            showList();
          }}
        />
      ) : view.kind === 'remove' &&
        activeClassification !== undefined &&
        query.data !== undefined ? (
        <RemoveTypeForm
          kind={kind}
          classification={activeClassification}
          classifications={query.data}
          onBack={() => {
            showList(activeClassification.id);
          }}
          onRemoved={() => {
            showList();
          }}
        />
      ) : (
        <section className={styles['settings']}>
          <div className={styles['header']}>
            <h2 className={styles['title']}>{title}</h2>
            <button
              type="button"
              className={styles['rowAction']}
              aria-label="Close"
              onClick={onClose}
            >
              <svg className={styles['icon']} aria-hidden="true" viewBox="0 0 24 24">
                <path d={CLOSE_ICON_PATH} />
              </svg>
            </button>
          </div>
          {query.data === undefined ? (
            query.isError ? (
              <LoadError
                message="Could not load types."
                onRetry={() => {
                  void query.refetch();
                }}
              />
            ) : (
              <Skeleton className={styles['fieldSkeleton']} />
            )
          ) : (
            <>
              <ul className={styles['list']}>
                {query.data.map((classification) => (
                  <li key={classification.id} className={styles['row']}>
                    {view.kind === 'rename' && view.id === classification.id ? (
                      <TypeNameForm
                        kind={kind}
                        classification={classification}
                        onBack={() => {
                          showList(classification.id);
                        }}
                        onSaved={() => {
                          showList(classification.id);
                        }}
                      />
                    ) : (
                      <>
                        <span className={styles['rowIdentity']}>
                          {classification.name}
                          {classification.is_default && (
                            <span className={styles['defaultLabel']}>Default</span>
                          )}
                        </span>
                        <div className={styles['actions']}>
                          <button
                            type="button"
                            className={styles['rowAction']}
                            aria-label={`Edit ${classification.name}`}
                            title="Edit"
                            id={`${listId}-${classification.id}`}
                            onClick={() => {
                              setView({ kind: 'rename', id: classification.id });
                            }}
                          >
                            <svg className={styles['icon']} aria-hidden="true" viewBox="0 0 24 24">
                              <path d={EDIT_ICON_PATH} />
                            </svg>
                          </button>
                          {query.data.length > 1 && (
                            <button
                              type="button"
                              className={`${styles['rowAction'] ?? ''} ${styles['danger'] ?? ''}`}
                              aria-label={`Delete ${classification.name}`}
                              title="Delete"
                              onClick={() => {
                                setView({ kind: 'remove', id: classification.id });
                              }}
                            >
                              <svg
                                className={styles['icon']}
                                aria-hidden="true"
                                viewBox="0 0 24 24"
                              >
                                <path d={DELETE_ICON_PATH} />
                              </svg>
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className={styles['newType']}
                onClick={() => {
                  setView({ kind: 'create' });
                }}
              >
                New type
              </button>
            </>
          )}
        </section>
      )}
    </Sheet>
  );
}

export function ClassificationSettings({ kind }: ClassificationSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={styles['manageTypes']}
        onClick={() => {
          setIsOpen(true);
        }}
      >
        Manage types
      </button>
      {isOpen && (
        <ClassificationSheet
          kind={kind}
          onClose={() => {
            setIsOpen(false);
          }}
        />
      )}
    </>
  );
}
