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
import CashDrawersList from './pages/CashDrawersList';
import ClientsPage from './pages/ClientsPage';
import Pos from './pages/Pos';
import ListSales from './pages/listSales';
import ApiTest from './pages/ApiTest';
import Products from './pages/Products';
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
      <h1>🍽️ Nefesh Pos</h1>
      <div className="nav-links">
        {/* Operaciones */}
        <a href="/dashboard" className={isActive('/dashboard')} title="Dashboard">📊 Dashboard</a>
        <a href="/pos" className={isActive('/pos')} title="Punto de Venta">🛒 POS</a>
        <a href="/products" className={isActive('/products')} title="Gestión de Productos">📦 Productos</a>

        {/* Ventas y Clientes */}
        <a href="/list-sales" className={isActive('/list-sales')} title="Historial de Ventas">💾 Ventas</a>
        <a href="/clients" className={isActive('/clients')} title="Gestión de Clientes">👥 Clientes</a>

        {/* Facturación */}
        <a href="/sale-to-invoice" className={isActive('/sale-to-invoice')} title="Convertir Venta a Factura">📄 Timbrar</a>
        <a href="/global-invoice" className={isActive('/global-invoice')} title="Factura Consolidada">🏢 Global</a>
        <a href="/client-invoice" className={isActive('/client-invoice')} title="Factura por Cliente">👤 Cliente</a>
        <a href="/invoices" className={isActive('/invoices')} title="Listado de Facturas">📋 Facturas</a>

        {/* Reportes */}
        <a href="/cash-drawer" className={isActive('/cash-drawer')} title="Crear nuevo Corte de Caja">➕ Corte</a>
        <a href="/cash-drawers-list" className={isActive('/cash-drawers-list')} title="Historial de Cortes">📈 Cortes</a>

        {/* Configuración */}
        <a href="/settings" className={isActive('/settings')} title="Configuración del Negocio">⚙️ Config</a>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', whiteSpace: 'nowrap' }}>
        <span style={{ fontSize: '0.9rem', opacity: 0.95 }}>👤 {user?.email || 'Usuario'}</span>
        <button onClick={handleLogout}>🚪 Salir</button>
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
          path="/cash-drawers-list"
          element={
            <ProtectedRoute>
              <Navbar />
              <main className="main-content">
                <CashDrawersList />
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
