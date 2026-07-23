import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { authService } from '../services/api';
import '../styles/navbar.css';

const NAV_ITEMS = [
  { path: '/pos',          label: 'POS',     icon: '🛒' },
  { path: '/dashboard',    label: 'Dashboard', icon: '📊' },
  { path: '/products',     label: 'Productos', icon: '📦' },
  { path: '/list-sales',   label: 'Ventas',  icon: '💾' },
  { path: '/clients',      label: 'Clientes', icon: '👥' },
  { path: '/invoices',     label: 'Facturas', icon: '📋' },
  { path: '/cash-drawer',  label: 'Cortes de Caja', icon: '🧾' },
  { path: '/settings',     label: 'Configuración', icon: '⚙️' },
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

  return (
    <header className="navbar-modern" role="banner">
      <Link to="/dashboard" className="navbar-modern__brand" onClick={() => setOpen(false)}>
        <span className="navbar-modern__brand-mark" aria-hidden>N</span>
        <span>Nefesh</span>
      </Link>

      <nav className={`navbar-modern__primary ${open ? 'open' : ''}`} aria-label="Principal">
        {NAV_ITEMS.map(item => {
          const active = location.pathname === item.path
            || (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-link ${active ? 'active' : ''}`}
              onClick={() => setOpen(false)}
            >
              <span className="nav-link__icon" aria-hidden>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
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
