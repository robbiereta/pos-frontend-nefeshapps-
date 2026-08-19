import React, { useState, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { authService } from '../services/api';
import '../styles/navbar.css';

// Each nav item lives in exactly one section. Section order = visual order
// left → right. Sections render with a thin divider between them on desktop
// and stack as labelled groups on the mobile sheet.
const NAV_SECTIONS = [
  {
    id: 'operacion',
    label: 'Operación',
    items: [
      { path: '/pos',        label: 'POS' },
      { path: '/dashboard',  label: 'Dashboard' },
      { path: '/products',   label: 'Productos' },
      { path: '/list-sales', label: 'Ventas' },
      { path: '/clients',    label: 'Clientes' },
    ],
  },
  {
    id: 'finanzas',
    label: 'Finanzas',
    items: [
      { path: '/invoices',         label: 'Facturas' },
      { path: '/notes-receivable', label: 'Notas por Cobrar' },
      { path: '/notes-payable',    label: 'Notas por Pagar' },
      { path: '/cash-drawer',      label: 'Cortes de Caja' },
    ],
  },
  {
    id: 'sistema',
    label: 'Sistema',
    items: [
      { path: '/team',       label: 'Equipo' },
      { path: '/categories', label: 'Categorías' },
      { path: '/settings',   label: 'Configuración' },
    ],
  },
];

function initials(email) {
  if (!email) return '?';
  const name = email.split('@')[0] || email;
  return name.slice(0, 2).toUpperCase();
}

export default function NavbarModern() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const user = authService.getCurrentUser();

  const handleLogout = () => {
    authService.logout();
    window.location.href = '/login';
  };

  const isActive = (path) =>
    location.pathname === path
    || (path !== '/dashboard' && location.pathname.startsWith(path));

  // Flatten once for the legacy "any link active" check used by the mobile toggle.
  const flatItems = useMemo(() => NAV_SECTIONS.flatMap(s => s.items), []);

  return (
    <header className="navbar-modern" role="banner">
      <Link to="/dashboard" className="navbar-modern__brand" onClick={() => setOpen(false)}>
        <span className="navbar-modern__brand-mark" aria-hidden>N</span>
        <span>Nefesh</span>
      </Link>

      <nav className={`navbar-modern__primary ${open ? 'open' : ''}`} aria-label="Principal">
        {NAV_SECTIONS.map((section, sIdx) => (
          <React.Fragment key={section.id}>
            {sIdx > 0 && <span className="navbar-modern__divider" aria-hidden />}
            <div className="navbar-modern__section" data-section={section.id}>
              {section.items.map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`nav-link ${isActive(item.path) ? 'active' : ''}`}
                  onClick={() => setOpen(false)}
                >
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </React.Fragment>
        ))}
        {/* Mobile-only section labels */}
        {open && (
          <div className="navbar-modern__section-labels">
            {NAV_SECTIONS.map(section => (
              <div key={section.id} className="navbar-modern__section-label">
                {section.label}
              </div>
            ))}
          </div>
        )}
      </nav>

      <div className="navbar-modern__spacer" />

      <div className="navbar-modern__actions">
        <span className="user-chip" title={user?.email || 'Usuario'}>
          <span className="user-avatar" aria-hidden>{initials(user?.email)}</span>
          <span className="user-chip__email hidden-sm">{user?.email || 'Usuario'}</span>
        </span>
        <button
          className="btn-logout-modern"
          onClick={handleLogout}
          aria-label="Cerrar sesión"
        >
          <span aria-hidden>↩</span>
          <span className="hidden-sm">Salir</span>
        </button>
        <button
          className="navbar-modern__toggle"
          aria-label="Abrir menú"
          aria-expanded={open}
          onClick={() => setOpen(o => !o)}
        >
          <span />
        </button>
      </div>
    </header>
  );
}
