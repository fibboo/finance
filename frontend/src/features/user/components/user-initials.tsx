import { useQuery } from '@tanstack/react-query';

import { userQueries } from '../api/user-queries';
import { formatInitials } from './format-initials';

export function UserInitials() {
  const { data: user } = useQuery(userQueries.me());
  if (user === undefined) {
    return null;
  }

  return formatInitials(user.username);
}
