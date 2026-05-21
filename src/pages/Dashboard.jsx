import { useState, useEffect } from 'react';
import { invoiceService } from '../services/api';

export default function Dashboard() {
  const [stats, setStats] = useState({
    total: 0,
    stamped: 0,
    pending: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentInvoices, setRecentInvoices] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [invoicesResponse] = await Promise.all([
        invoiceService.getInvoices({ limit: 5 }),
      ]);
      
      const invoices = invoicesResponse.data || invoicesResponse || [];
      setRecentInvoices(invoices);
      
      setStats({
        total: invoices.length,
        stamped: invoices.filter(i => i.status === 'stamped' || i.uuid).length,
        pending: invoices.filter(i => i.status === 'pending').length,
      });
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Cargando...</div>;
  }

  return (
    <>
      <h2 style={{ marginBottom: '1.5rem' }}>Dashboard</h2>
      
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total Facturas</div>
        </div>
        <div className="stat-card success">
          <div className="stat-value">{stats.stamped}</div>
          <div className="stat-label">Timbradas</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-value">{stats.pending}</div>
          <div className="stat-label">Pendientes</div>
        </div>
      </div>

      <div className="card">
        <h2>Facturas Recientes</h2>
        {recentInvoices.length === 0 ? (
          <div className="empty-state">No hay facturas recientes</div>
        ) : (
          <table className="invoice-table">
            <thead>
              <tr>
                <th>UUID</th>
                <th>Fecha</th>
                <th>Total</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {recentInvoices.map((invoice) => (
                <tr key={invoice._id || invoice.uuid}>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                    {invoice.uuid || 'N/A'}
                  </td>
                  <td>{invoice.fecha ? new Date(invoice.fecha).toLocaleDateString('es-MX') : 'N/A'}</td>
                  <td>${invoice.total?.toFixed(2) || '0.00'}</td>
                  <td>
                    <span className={`status ${invoice.status || (invoice.uuid ? 'stamped' : 'pending')}`}>
                      {invoice.uuid ? 'Timbrada' : 'Pendiente'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
