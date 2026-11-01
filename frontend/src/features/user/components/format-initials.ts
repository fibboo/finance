const INITIALS_LENGTH = 2;

export function formatInitials(username: string): string {
  const initials = username.slice(0, INITIALS_LENGTH).toUpperCase();
  return initials;
}
