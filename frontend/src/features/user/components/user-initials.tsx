import { useQuery } from '@tanstack/react-query';

import { userQueries } from '../api/user-queries';

const INITIALS_LENGTH = 2;

export function UserInitials() {
  const { data: user } = useQuery(userQueries.me());
  if (user === undefined) {
    return null;
  }

  const initials = user.username.slice(0, INITIALS_LENGTH).toUpperCase();
  return initials;
}
