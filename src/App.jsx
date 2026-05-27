import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { authService } from './services/api';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import GlobalInvoice from './pages/GlobalInvoice';
import InvoiceList from './pages/InvoiceList';
import ClientInvoice from './pages/ClientInvoice';
import Pos from './pages/Pos';
import ListSales from './pages/listSales';
import ApiTest from './pages/ApiTest';
function Navbar() {
  const location = useLocation();
  const user = authService.getCurrentUser();

  const handleLogout = () => {
    authService.logout();
    window.location.href = '/login';
  };

  const isActive = (path) => location.pathname === path ? 'active' : '';

  return (
    <nav className="navbar">
      <h1>CFDI - Facturación</h1>
      <div className="nav-links">
        <a href="/dashboard" className={isActive('/dashboard')}>Dashboard</a>
        <a href="/pos" className={isActive('/pos')}>POS</a>
        <a href="/invoices" className={isActive('/invoices')}>Facturas</a>
        <a href="/global-invoice" className={isActive('/global-invoice')}>Factura Global</a>
        <a href="/client-invoice" className={isActive('/client-invoice')}>Factura Cliente</a>
        <a href="/list-sales" className={isActive('/list-sales')}>Listar Ventas</a>
        <a href="/api-test" className={isActive('/api-test')}>🧪 API Test</a>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span style={{ fontSize: '0.875rem' }}>{user?.email || 'Usuario'}</span>
        <button onClick={handleLogout}>Cerrar Sesión</button>
      </div>
    </nav>
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
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
