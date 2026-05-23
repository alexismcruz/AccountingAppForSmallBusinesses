import { createContext, useContext } from 'react';

const ROLE_LEVELS = { staff: 1, manager: 2, finance: 3, admin: 4, super_admin: 5 };

export const UserContext = createContext({
  user: { email: '', role: 'admin', name: '' },
  can: () => true,
});

export function useUser() {
  return useContext(UserContext);
}

export function makeUserContext(user) {
  const role = user?.role || 'admin';
  return {
    user,
    can: (minRole) => (ROLE_LEVELS[role] || 0) >= (ROLE_LEVELS[minRole] || 0),
  };
}
