// Lightweight hook for the current user's tenant role.
//
// Reads from localStorage.user (set on login / refreshed by the team
// list endpoint). Avoids a context provider because the user object
// is small and the page that needs it usually re-renders once on
// mount, not on every interaction.
//
// Returns:
//   { user, tenantRole, isOwner, isAdmin, can(allowedRoles) }
//
//     user         — the parsed localStorage object, or null
//     tenantRole   — 'owner' | 'admin' | 'user' | 'viewer' | undefined
//     isOwner      — true when tenantRole === 'owner'
//     isAdmin      — true when tenantRole === 'admin' or 'owner'
//     can(roles)   — true when the caller's tenantRole is in `roles`
import { useCallback, useState } from 'react';

const readUser = () => {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export function useCurrentUser() {
  // Re-read on every render so a team-role change picked up by
  // the team list refresh immediately reflects in admin gating.
  const [user] = useState(() => readUser());
  const tenantRole = user?.tenantRole;
  const isOwner = tenantRole === 'owner';
  const isAdmin = tenantRole === 'admin' || isOwner;
  const can = useCallback(
    (allowed) => !allowed || allowed.length === 0 || (tenantRole && allowed.includes(tenantRole)),
    [tenantRole]
  );
  return { user, tenantRole, isOwner, isAdmin, can };
}

export default useCurrentUser;
