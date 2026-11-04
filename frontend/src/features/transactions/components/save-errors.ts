import { ApiError } from '@/lib/api-error';

const SERVER_ERROR_STATUS = 500;

export type SaveError<Field extends string> = Readonly<{
  field: Field | 'root.server';
  message: string;
}>;

export function readSaveErrors<Field extends string>({
  error,
  fields,
  fallbackMessage,
}: Readonly<{
  error: unknown;
  fields: readonly Field[];
  fallbackMessage: string;
}>): readonly SaveError<Field>[] {
  if (!(error instanceof ApiError) || error.fieldErrors.length === 0) {
    const message =
      error instanceof ApiError && error.status < SERVER_ERROR_STATUS
        ? error.message
        : fallbackMessage;
    return [{ field: 'root.server', message }];
  }

  const saveErrors = error.fieldErrors.map((fieldError): SaveError<Field> => ({
    field: fields.find((field) => field === fieldError.field) ?? 'root.server',
    message: fieldError.message,
  }));
  return saveErrors;
}
