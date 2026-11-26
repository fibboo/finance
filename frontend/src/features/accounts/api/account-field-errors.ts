import { ApiError } from '@/lib/api-error';

const ACCOUNT_FIELDS = ['name', 'description'] as const;

export type AccountFieldError = Readonly<{
  field: (typeof ACCOUNT_FIELDS)[number] | 'root.server';
  message: string;
}>;

export function readNameError(error: unknown): unknown {
  const nameError =
    error instanceof ApiError && error.error_code === 'NAME_ALREADY_EXISTS'
      ? new ApiError({
          status: error.status,
          message: error.message,
          error_code: error.error_code,
          fieldErrors: [{ field: 'name', message: error.message }],
        })
      : error;
  return nameError;
}

export function readAccountFieldErrors(error: Error): readonly AccountFieldError[] {
  const fieldErrors =
    error instanceof ApiError
      ? error.fieldErrors.map((fieldError) => ({
          field:
            ACCOUNT_FIELDS.find((field) => field === fieldError.field) ?? ('root.server' as const),
          message: fieldError.message,
        }))
      : [];
  return fieldErrors;
}
