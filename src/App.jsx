import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { authService } from './services/api';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import GlobalInvoice from './pages/GlobalInvoice';
import InvoiceList from './pages/InvoiceList';
import ClientInvoice from './pages/ClientInvoice';
import ClientInvoiceWorkflow from './pages/ClientInvoiceWorkflow';
import SaleToInvoice from './pages/SaleToInvoice';
import CashDrawer from './pages/CashDrawer';
import ClientsPage from './pages/ClientsPage';
import Pos from './pages/Pos';
import ListSales from './pages/listSales';
import ApiTest from './pages/ApiTest';
import Products from './pages/Products';
function Navbar() {
  const [isOpen, setIsOpen] = React.useState(false);
  const location = useLocation();
  const user = authService.getCurrentUser();

  const handleLogout = () => {
    authService.logout();
    window.location.href = '/login';
  };

  const isActive = (path) => location.pathname === path ? 'active' : '';

  const navItems = [
    { path: '/pos', label: 'POS', icon: '🛒', primary: true },
    { path: '/dashboard', label: 'Dashboard', icon: '📊', primary: true },
    { path: '/products', label: 'Productos', icon: '📦' },
    { path: '/list-sales', label: 'Ventas', icon: '💾' },
    { path: '/clients', label: 'Clientes', icon: '👥' },
    { path: '/invoices', label: 'Facturas', icon: '📋' },
    { path: '/cash-drawer', label: 'Cortes de Caja', icon: '➕' },
    { path: '/settings', label: 'Configuracion', icon: '⚙️' },
  ];

  const primaryItems = navItems.filter(item => item.primary);
  const secondaryItems = navItems.filter(item => !item.primary);

  return (
    <>
      <nav className="navbar">
        <h1 className="navbar-brand">Nefesh</h1>
        <button className={`hamburger ${isOpen ? 'open' : ''}`} onClick={() => setIsOpen(!isOpen)} aria-label="Menú">
          <span></span>
          <span></span>
          <span></span>
        </button>
        <div className={`nav-menu ${isOpen ? 'open' : ''}`}>
          <div className="nav-primary">
            {primaryItems.map(item => (
              <a
                key={item.path}
                href={item.path}
                className={`nav-item primary ${isActive(item.path)}`}
                onClick={() => setIsOpen(false)}
              >
                <span className="icon">{item.icon}</span>
                <span>{item.label}</span>
              </a>
            ))}
          </div>
          <div className="nav-divider"></div>
          <div className="nav-secondary">
            {secondaryItems.map(item => (
              <a
                key={item.path}
                href={item.path}
                className={`nav-item ${isActive(item.path)}`}
                onClick={() => setIsOpen(false)}
              >
                <span className="icon">{item.icon}</span>
                <span>{item.label}</span>
              </a>
            ))}
          </div>
          <div className="nav-divider"></div>
          <div className="nav-footer">
            <div className="user-info">
              <span className="user-email">👤 {user?.email || 'Usuario'}</span>
            </div>
            <button className="btn-logout" onClick={handleLogout}>🚪 Salir</button>
          </div>
        </div>
      </nav>
      {isOpen && <div className="nav-overlay" onClick={() => setIsOpen(false)}></div>}
    </>
  );
}

function ProtectedRoute({ children }) {
  if (!authService.isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Navbar />
              <main className="main-content">
                <Dashboard />
              </main>
            </ProtectedRoute>
          }
        />
        <Route
          path="/pos"
          element={
            <ProtectedRoute>
              <Navbar />
              <main className="main-content">
                <Pos />
              </main>
            </ProtectedRoute>
          }
        />
        <Route
          path="/global-invoice"
          element={
            <ProtectedRoute>
              <Navbar />
              <main className="main-content">
                <GlobalInvoice />
              </main>
            </ProtectedRoute>
          }
        />
        <Route
          path="/invoices"
          element={
            <ProtectedRoute>
              <Navbar />
              <main className="main-content">
                <InvoiceList />
              </main>
            </ProtectedRoute>
          }
        />
        <Route
          path="/client-invoice"
          element={
            <ProtectedRoute>
              <Navbar />
              <main className="main-content">
                <ClientInvoice />
              </main>
            </ProtectedRoute>
          }
        />
        <Route
          path="/client-invoice-workflow"
          element={
            <ProtectedRoute>
              <Navbar />
              <main className="main-content">
                <ClientInvoiceWorkflow />
              </main>
            </ProtectedRoute>
          }
        />
        <Route
          path="/sale-to-invoice"
          element={
            <ProtectedRoute>
              <Navbar />
              <main className="main-content">
                <SaleToInvoice />
              </main>
            </ProtectedRoute>
          }
        />
        <Route
          path="/list-sales"
          element={
            <ProtectedRoute>
              <Navbar />
              <main className="main-content">
                <ListSales />
              </main>
            </ProtectedRoute>
          }
        />
        <Route
          path="/cash-drawer"
          element={
            <ProtectedRoute>
              <Navbar />
              <main className="main-content">
                <CashDrawer />
              </main>
            </ProtectedRoute>
          }
        />
        <Route
          path="/clients"
          element={
            <ProtectedRoute>
              <Navbar />
              <main className="main-content">
                <ClientsPage />
              </main>
            </ProtectedRoute>
          }
        />
        <Route
          path="/api-test"
          element={
            <ProtectedRoute>
              <Navbar />
              <main className="main-content">
                <ApiTest />
              </main>
            </ProtectedRoute>
          }
        />
        <Route
          path="/products"
          element={
            <ProtectedRoute>
              <Navbar />
              <main className="main-content">
                <Products />
              </main>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Navbar />
              <main className="main-content">
                <Settings />
              </main>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
