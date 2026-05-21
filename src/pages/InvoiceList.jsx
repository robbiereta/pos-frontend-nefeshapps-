import { useState, useEffect } from 'react';
import { invoiceService } from '../services/api';

export default function InvoiceList() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    fechaInicio: '',
    fechaFin: '',
  });

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async (params = {}) => {
    setLoading(true);
    setError(null);
    try {
      const response = await invoiceService.getInvoices(params);
      setInvoices(response.data || response || []);
    } catch (err) {
      setError('Error al cargar las facturas');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    setFilters({
      ...filters,
      [e.target.name]: e.target.value,
    });
  };

  const handleApplyFilters = (e) => {
    e.preventDefault();
    fetchInvoices(filters);
  };

  const handleClearFilters = () => {
    setFilters({ fechaInicio: '', fechaFin: '' });
    fetchInvoices();
  };

  const getStatusClass = (invoice) => {
    if (invoice.uuid) return 'completed';
    if (invoice.status === 'pending') return 'pending';
    return 'error';
  };

  const getStatusText = (invoice) => {
    if (invoice.uuid) return 'Timbrada';
    if (invoice.status === 'pending') return 'Pendiente';
    return 'Error';
  };

  if (loading && invoices.length === 0) {
    return <div className="loading">Cargando facturas...</div>;
  }

  return (
    <>
      <h2 style={{ marginBottom: '1.5rem' }}>Lista de Facturas</h2>

      <div className="card">
        <h2>Filtrar Facturas</h2>
        <form onSubmit={handleApplyFilters} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="fechaInicio">Fecha Inicio</label>
            <input
              type="date"
              id="fechaInicio"
              name="fechaInicio"
              value={filters.fechaInicio}
              onChange={handleFilterChange}
              style={{ width: 'auto' }}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="fechaFin">Fecha Fin</label>
            <input
              type="date"
              id="fechaFin"
              name="fechaFin"
              value={filters.fechaFin}
              onChange={handleFilterChange}
              style={{ width: 'auto' }}
            />
          </div>
          <button type="submit" className="btn btn-primary">Aplicar Filtros</button>
          <button type="button" className="btn" onClick={handleClearFilters} style={{ background: 'var(--gray-200)', color: 'var(--gray-700)' }}>
            Limpiar
          </button>
        </form>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="card">
        {invoices.length === 0 ? (
          <div className="empty-state">No hay facturas disponibles</div>
        ) : (
          <table className="invoice-table">
            <thead>
              <tr>
                <th>UUID</th>
                <th>Fecha</th>
                <th>Receptor</th>
                <th>Total</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice._id || invoice.uuid}>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                    {invoice.uuid || 'N/A'}
                  </td>
                  <td>{invoice.fecha ? new Date(invoice.fecha).toLocaleDateString('es-MX') : 'N/A'}</td>
                  <td>{invoice.receptor?.nombre || invoice.receptorName || 'PUBLICO EN GENERAL'}</td>
                  <td>${invoice.total?.toFixed(2) || '0.00'}</td>
                  <td>
                    <span className={`status ${getStatusClass(invoice)}`}>
                      {getStatusText(invoice)}
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
