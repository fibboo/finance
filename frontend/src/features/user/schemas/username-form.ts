import { z } from 'zod';

export const USERNAME_RULE = '3–32 letters, digits, dots, underscores or hyphens.';
export const USERNAME_ERROR = `Use ${USERNAME_RULE}`;

const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,32}$/;

export const usernameSchema = z.string().trim().regex(USERNAME_PATTERN, USERNAME_ERROR);

export const usernameFormSchema = z.object({
  username: usernameSchema,
});
