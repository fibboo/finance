import { ApiError } from '@/lib/api-error';

const ACCOUNT_FIELDS = ['name', 'description'] as const;

export type AccountFieldError = Readonly<{
  field: (typeof ACCOUNT_FIELDS)[number] | 'root.server';
  message: string;
}>;

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
