import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { authService } from '../services/api';
import '../styles/navbar.css';

// Each nav item lives in exactly one section. Sections render as
// dropdowns (Operación / Finanzas / Sistema) on desktop and stack
// as labelled groups on the mobile sheet.
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
      { path: '/team',             label: 'Equipo' },
      { path: '/categories',       label: 'Categorías' },
      { path: '/ticket-designer',  label: 'Ticket Designer' },
      { path: '/settings',         label: 'Configuración' },
    ],
  },
];

function initials(email) {
  if (!email) return '?';
  const name = email.split('@')[0] || email;
  return name.slice(0, 2).toUpperCase();
}

export default function NavbarModern() {
  const [open, setOpen] = useState(false);                  // mobile sheet
  const [openSection, setOpenSection] = useState(null);     // desktop dropdown
  const navRef = useRef(null);
  const location = useLocation();
  const user = authService.getCurrentUser();

  const handleLogout = () => {
    authService.logout();
    window.location.href = '/login';
  };

  const isActive = (path) =>
    location.pathname === path
    || (path !== '/dashboard' && location.pathname.startsWith(path));

  // A section is considered "current" if the active route lives in it.
  const activeSectionId = useMemo(() => {
    for (const section of NAV_SECTIONS) {
      if (section.items.some((it) => isActive(it.path))) return section.id;
    }
    return null;
  }, [location.pathname]);

  // Click-outside closes any open dropdown. The mobile sheet (`open`)
  // has its own toggle button so we don't auto-close it here.
  useEffect(() => {
    if (openSection === null) return undefined;
    const handleClick = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) {
        setOpenSection(null);
      }
    };
    const handleEsc = (e) => {
      if (e.key === 'Escape') setOpenSection(null);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [openSection]);

  // Auto-close the dropdown on route change.
  useEffect(() => {
    setOpenSection(null);
    setOpen(false);
  }, [location.pathname]);

  const toggleSection = (id) => {
    setOpenSection((cur) => (cur === id ? null : id));
  };

  return (
    <header className="navbar-modern" role="banner" ref={navRef}>
      <Link to="/dashboard" className="navbar-modern__brand" onClick={() => { setOpen(false); setOpenSection(null); }}>
        <span className="navbar-modern__brand-mark" aria-hidden>n</span>
        <span>npos</span>
      </Link>

      <nav className={`navbar-modern__primary ${open ? 'open' : ''}`} aria-label="Principal">
        {NAV_SECTIONS.map((section) => {
          const isOpen = openSection === section.id;
          const isCurrent = activeSectionId === section.id;
          return (
            <div
              key={section.id}
              className={`nav-dropdown ${isOpen ? 'is-open' : ''} ${isCurrent ? 'is-current' : ''}`}
              data-section={section.id}
            >
              <button
                type="button"
                className="nav-dropdown__trigger"
                aria-expanded={isOpen}
                aria-haspopup="menu"
                onClick={() => toggleSection(section.id)}
              >
                <span>{section.label}</span>
                <span className="nav-dropdown__caret" aria-hidden>▾</span>
              </button>
              <div className="nav-dropdown__panel" role="menu">
                {section.items.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    role="menuitem"
                    className={`nav-dropdown__item ${isActive(item.path) ? 'active' : ''}`}
                    onClick={() => { setOpenSection(null); setOpen(false); }}
                  >
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}

        {/* Mobile-only section labels (visible when the hamburger is open) */}
        {open && (
          <div className="navbar-modern__section-labels">
            {NAV_SECTIONS.map((section) => (
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
