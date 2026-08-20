// Tenant-role-based route guard.
//
// Reads the tenantRole from localStorage.user (set on login) and
// either renders the children or redirects to /. The backend
// enforces the same rules with its `requireRole` middleware; this
// is a UX shortcut so sub-users don't see "403" pages in the
// first place.
//
// Usage in App.jsx:
//   <Route element={<RoleGuard allow={['owner', 'admin']} />}>
//     <Route path="/settings" element={<Settings />} />
//   </Route>
//
// If `allow` is omitted, any authenticated user passes.
import { Navigate, useLocation } from 'react-router-dom';

const readUser = () => {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export default function RoleGuard({ allow, children }) {
  const location = useLocation();
  const user = readUser();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!allow || allow.length === 0) {
    return children;
  }

  // The login response sets user.tenantRole on the stored user
  // object. Fall back to 'admin' for the very first login before
  // the role is loaded — the backend still enforces the real
  // check on every request.
  const tenantRole = user.tenantRole || 'admin';
  if (!allow.includes(tenantRole)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
