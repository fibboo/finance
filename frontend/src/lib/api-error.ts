import { z } from 'zod';

import type { components } from '@/lib/api-schema';

type ErrorCode = components['schemas']['ErrorCodeType'];

export type FieldError = Readonly<{
  field: string;
  message: string;
}>;

type ApiErrorFields = Readonly<{
  status: number;
  message: string;
  error_code: ErrorCode | null;
  fieldErrors: readonly FieldError[];
}>;

export const UNAUTHORIZED_STATUS = 401;
export const NOT_FOUND_STATUS = 404;
const VALIDATION_MESSAGE = 'The request is not valid.';

const errorResponseSchema = z.object({
  message: z.string(),
  error_code: z.custom<ErrorCode>((value) => typeof value === 'string').nullish(),
});
const validationErrorSchema = z.object({
  detail: z.array(z.object({ loc: z.array(z.union([z.string(), z.number()])), msg: z.string() })),
});

export class ApiError extends Error {
  readonly status: number;
  readonly error_code: ErrorCode | null;
  readonly fieldErrors: readonly FieldError[];

  constructor({ status, message, error_code, fieldErrors }: ApiErrorFields) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.error_code = error_code;
    this.fieldErrors = fieldErrors;
  }
}

export async function readApiError(response: Response): Promise<ApiError> {
  const body: unknown = await response.json().catch(() => null);
  const errorResponse = errorResponseSchema.safeParse(body);
  const validationError = validationErrorSchema.safeParse(body);
  const fieldErrors = (validationError.data?.detail ?? []).map((item) => ({
    field: item.loc.slice(1).join('.'),
    message: item.msg,
  }));
  const fallbackMessage = validationError.success
    ? VALIDATION_MESSAGE
    : `The request failed with status ${String(response.status)}.`;
  const apiError = new ApiError({
    status: response.status,
    message: errorResponse.data?.message ?? fallbackMessage,
    error_code: errorResponse.data?.error_code ?? null,
    fieldErrors,
  });
  return apiError;
}
