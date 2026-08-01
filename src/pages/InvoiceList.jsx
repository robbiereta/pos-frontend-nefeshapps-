import { useState, useEffect } from 'react';
import { invoiceService } from '../services/api';
import { useToast } from '../components/ui/Toast.jsx';

const formatDate = (dateStr) => {
  try {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return dateStr;
    }
    return date.toLocaleDateString('es-MX');
  } catch {
    return dateStr || 'N/A';
  }
};

export default function InvoiceList() {
  const [invoices, setInvoices] = useState([]);
  const [displayedInvoices, setDisplayedInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const toast = useToast();
  const [filters, setFilters] = useState({
    fechaInicio: '',
    fechaFin: '',
  });
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  useEffect(() => {
    fetchInvoices();
  }, []);

  useEffect(() => {
    const filtered = invoices.filter(invoice =>
      (invoice.folio || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (invoice.uuid || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (invoice.receptor?.nombre || invoice.receptorName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (invoice.receptor?.rfc || invoice.receptorRfc || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    setDisplayedInvoices(filtered.slice(startIndex, endIndex));
  }, [searchQuery, currentPage, invoices]);

  const fetchInvoices = async (params = {}) => {
    setLoading(true);
    setError(null);
    try {
      const response = await invoiceService.getInvoices(params);
      setInvoices(response.data || response || []);
    } catch (err) {
      setError('Error al cargar las facturas');
      toast.error('Error al cargar las facturas');
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

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <input
          type="text"
          placeholder="Buscar por folio, UUID, nombre o RFC del receptor..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
          style={{
            width: '100%',
            padding: '10px 12px',
            fontSize: '14px',
            borderRadius: '4px',
            border: '1px solid #ddd',
            boxSizing: 'border-box'
          }}
        />
      </div>

      <div className="card">
        {invoices.length === 0 ? (
          <div className="empty-state">No hay facturas disponibles</div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.9rem'
              }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--gray-100)', borderBottom: '2px solid var(--gray-300)' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>UUID</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Fecha</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Folio</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Receptor</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Subtotal</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>IVA</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Total</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Estado</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedInvoices.map((invoice, idx) => (
                  <tr key={invoice._id || invoice.uuid} style={{
                    borderBottom: '1px solid var(--gray-200)',
                    backgroundColor: idx % 2 === 0 ? 'white' : 'var(--gray-50)',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--blue-50)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = idx % 2 === 0 ? 'white' : 'var(--gray-50)';
                  }}
                  >
                    <td style={{ padding: '0.75rem', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {invoice.uuid ? invoice.uuid.slice(0, 8) + '...' : 'N/A'}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      {formatDate(invoice.fecha)}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      {invoice.folio || invoice.serie || 'N/A'}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      {invoice.receptor?.nombre || invoice.receptorName || 'PÚBLICO EN GENERAL'}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      ${((invoice.total || 0) / 1.16).toFixed(2)}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      ${((invoice.total || 0) - (invoice.total || 0) / 1.16).toFixed(2)}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold' }}>
                      ${invoice.total?.toFixed(2) || '0.00'}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-block',
                        backgroundColor: invoice.uuid ? '#10b981' : '#f59e0b',
                        color: 'white',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: '500'
                      }}>
                        {getStatusText(invoice)}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <button
                        onClick={() => setSelectedInvoice(invoice)}
                        style={{
                          padding: '0.4rem 0.75rem',
                          backgroundColor: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => {
                          e.target.style.backgroundColor = '#2563eb';
                        }}
                        onMouseOut={(e) => {
                          e.target.style.backgroundColor = '#3b82f6';
                        }}
                      >
                        👁️ Ver
                      </button>
                    </td>
                  </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {Math.ceil(
              invoices.filter(invoice =>
                (invoice.folio || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (invoice.uuid || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (invoice.receptor?.nombre || invoice.receptorName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (invoice.receptor?.rfc || invoice.receptorRfc || '').toLowerCase().includes(searchQuery.toLowerCase())
              ).length / itemsPerPage
            ) > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '20px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  style={{ padding: '8px 12px', opacity: currentPage === 1 ? 0.5 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                  className="btn"
                >
                  ◀◀ Primera
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  style={{ padding: '8px 12px', opacity: currentPage === 1 ? 0.5 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                  className="btn"
                >
                  ◀ Anterior
                </button>

                <span style={{ margin: '0 8px', fontSize: '14px', fontWeight: '600' }}>
                  Página {currentPage} de {Math.ceil(
                    invoices.filter(invoice =>
                      (invoice.folio || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (invoice.uuid || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (invoice.receptor?.nombre || invoice.receptorName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (invoice.receptor?.rfc || invoice.receptorRfc || '').toLowerCase().includes(searchQuery.toLowerCase())
                    ).length / itemsPerPage
                  )}
                </span>

                <button
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil(
                    invoices.filter(invoice =>
                      (invoice.folio || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (invoice.uuid || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (invoice.receptor?.nombre || invoice.receptorName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (invoice.receptor?.rfc || invoice.receptorRfc || '').toLowerCase().includes(searchQuery.toLowerCase())
                    ).length / itemsPerPage
                  ), p + 1))}
                  disabled={currentPage === Math.ceil(
                    invoices.filter(invoice =>
                      (invoice.folio || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (invoice.uuid || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (invoice.receptor?.nombre || invoice.receptorName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (invoice.receptor?.rfc || invoice.receptorRfc || '').toLowerCase().includes(searchQuery.toLowerCase())
                    ).length / itemsPerPage
                  )}
                  style={{ padding: '8px 12px', cursor: currentPage === Math.ceil(
                    invoices.filter(invoice =>
                      (invoice.folio || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (invoice.uuid || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (invoice.receptor?.nombre || invoice.receptorName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (invoice.receptor?.rfc || invoice.receptorRfc || '').toLowerCase().includes(searchQuery.toLowerCase())
                    ).length / itemsPerPage
                  ) ? 'not-allowed' : 'pointer', opacity: currentPage === Math.ceil(
                    invoices.filter(invoice =>
                      (invoice.folio || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (invoice.uuid || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (invoice.receptor?.nombre || invoice.receptorName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (invoice.receptor?.rfc || invoice.receptorRfc || '').toLowerCase().includes(searchQuery.toLowerCase())
                    ).length / itemsPerPage
                  ) ? 0.5 : 1 }}
                  className="btn"
                >
                  Siguiente ▶
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Invoice Details Modal */}
      {selectedInvoice && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}
        onClick={() => setSelectedInvoice(null)}
        >
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '2rem',
            maxWidth: '700px',
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3>Detalles de Factura</h3>
              <button
                onClick={() => setSelectedInvoice(null)}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
              <div>
                <p style={{ color: 'var(--gray-600)', fontSize: '0.9rem' }}>UUID</p>
                <p style={{ fontSize: '0.9rem', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  {selectedInvoice.uuid || 'No timbrada'}
                </p>
              </div>
              <div>
                <p style={{ color: 'var(--gray-600)', fontSize: '0.9rem' }}>Estado</p>
                <span style={{
                  display: 'inline-block',
                  backgroundColor: selectedInvoice.uuid ? '#10b981' : '#f59e0b',
                  color: 'white',
                  padding: '0.4rem 0.75rem',
                  borderRadius: '4px',
                  fontSize: '0.9rem',
                  fontWeight: '600'
                }}>
                  {getStatusText(selectedInvoice)}
                </span>
              </div>
              <div>
                <p style={{ color: 'var(--gray-600)', fontSize: '0.9rem' }}>Fecha</p>
                <p style={{ fontSize: '1rem', fontWeight: '600' }}>
                  {formatDate(selectedInvoice.fecha)}
                </p>
              </div>
              <div>
                <p style={{ color: 'var(--gray-600)', fontSize: '0.9rem' }}>Folio</p>
                <p style={{ fontSize: '1rem', fontWeight: '600' }}>
                  {selectedInvoice.folio || 'N/A'}
                </p>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--gray-300)', paddingTop: '1.5rem', marginBottom: '2rem' }}>
              <h4 style={{ marginBottom: '1rem' }}>Receptor</h4>
              <p><strong>Nombre:</strong> {selectedInvoice.receptor?.nombre || selectedInvoice.receptorName || 'PÚBLICO EN GENERAL'}</p>
              <p><strong>RFC:</strong> {selectedInvoice.receptor?.rfc || selectedInvoice.receptorRfc || 'N/A'}</p>
              <p><strong>Régimen:</strong> {selectedInvoice.receptor?.regimen || 'N/A'}</p>
            </div>

            <div style={{ borderTop: '1px solid var(--gray-300)', paddingTop: '1.5rem', marginBottom: '2rem' }}>
              <h4 style={{ marginBottom: '1rem' }}>Montos</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <p style={{ color: 'var(--gray-600)', fontSize: '0.9rem' }}>Subtotal</p>
                  <p style={{ fontSize: '1.1rem', fontWeight: '600' }}>
                    ${((selectedInvoice.total || 0) / 1.16).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p style={{ color: 'var(--gray-600)', fontSize: '0.9rem' }}>IVA (16%)</p>
                  <p style={{ fontSize: '1.1rem', fontWeight: '600' }}>
                    ${((selectedInvoice.total || 0) - (selectedInvoice.total || 0) / 1.16).toFixed(2)}
                  </p>
                </div>
                <div style={{ gridColumn: '1 / -1', borderTop: '2px solid var(--gray-300)', paddingTop: '1rem' }}>
                  <p style={{ color: 'var(--gray-600)', fontSize: '0.9rem' }}>Total</p>
                  <p style={{ fontSize: '1.3rem', fontWeight: '700', color: 'var(--primary-color)' }}>
                    ${selectedInvoice.total?.toFixed(2) || '0.00'}
                  </p>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setSelectedInvoice(null)}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: 'var(--gray-200)',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Cerrar
              </button>
              {selectedInvoice.uuid && (
                <button
                  onClick={() => {
                    window.open(`https://consultaqr.facturaelectronica.sat.gob.mx/ConsultaCFDIService.Credentials.htm?re=${selectedInvoice.emisor?.rfc || ''}&rr=${selectedInvoice.receptor?.rfc || 'XAXX010101000'}&tt=${selectedInvoice.total || 0}&id=${selectedInvoice.uuid}`, '_blank');
                  }}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  🔍 Verificar SAT
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
