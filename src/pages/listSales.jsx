import { salesService } from '../services/api';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/ui/Toast.jsx';
import './ListSales.css';

const ListSales = () => {
  const navigate = useNavigate();
  const [allSales, setAllSales] = useState([]);
  const [displayedSales, setDisplayedSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSale, setSelectedSale] = useState(null);
  const toast = useToast();
  const [showDetails, setShowDetails] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  const getSales = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('📋 Fetching sales...');
      const salesData = await salesService.getAllSales({ limit: 1000 });
      console.log('📋 Sales data received:', JSON.stringify(salesData, null, 2));
      console.log('📋 Sales data type:', typeof salesData);
      console.log('📋 Is array:', Array.isArray(salesData));
      console.log('📋 Sales length:', Array.isArray(salesData) ? salesData.length : 'not an array');
      setAllSales(Array.isArray(salesData) ? salesData : []);
      setCurrentPage(1);
    } catch (error) {
      console.error('❌ Error fetching sales:', error);
      setError(error.message || 'Error loading sales');
      toast.error(error.message || 'Error al cargar ventas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getSales();
  }, []);

  useEffect(() => {
    const filtered = allSales.filter(sale =>
      sale.folio.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (sale.customer?.nombre || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (sale.customer?.rfc || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    setDisplayedSales(filtered.slice(startIndex, endIndex));
  }, [searchQuery, currentPage, allSales]);

  const totalPages = Math.ceil(
    allSales.filter(sale =>
      sale.folio.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (sale.customer?.nombre || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (sale.customer?.rfc || '').toLowerCase().includes(searchQuery.toLowerCase())
    ).length / itemsPerPage
  );

  const handleViewDetails = (sale) => {
    console.log('Sale selected:', sale);
    console.log('Items:', sale.items);
    console.log('Sale data structure:', JSON.stringify(sale, null, 2));
    setSelectedSale(sale);
    setShowDetails(true);
  };

  const handlePrint = () => {
    if (!selectedSale) return;
    window.print();
  };

  const handleDelete = async (saleId) => {
    if (deleteConfirm !== saleId) {
      setDeleteConfirm(saleId);
      return;
    }

    try {
      await salesService.deleteSale(saleId);
      setAllSales(allSales.filter(s => s._id !== saleId));
      setShowDetails(false);
      setDeleteConfirm(null);
      alert('Venta eliminada exitosamente');
    } catch (error) {
      console.error('Error deleting sale:', error);
      alert(error.message || 'Error al eliminar la venta');
    }
  };

  const closeDetails = () => {
    setShowDetails(false);
    setSelectedSale(null);
    setDeleteConfirm(null);
  };


  if (loading) {
    return (
      <div style={{ padding: '20px' }}>
        <h1>Listar Ventas</h1>
        <p>Cargando ventas...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px' }}>
        <h1>Listar Ventas</h1>
        <p style={{ color: 'red' }}>Error: {error}</p>
        <button onClick={getSales} style={{ padding: '8px 16px', backgroundColor: '#2c5aa0', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Listar Ventas</h1>
        <button onClick={getSales} style={{ padding: '8px 16px', backgroundColor: '#2c5aa0', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          🔄 Actualizar
        </button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Buscar por folio, cliente o RFC..."
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

      {allSales.length === 0 ? (
        <p>No hay ventas registradas</p>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f0f0f0' }}>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Folio</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Cliente</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Total</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Estado</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Fecha</th>
                  <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>Estado</th>
                  <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {displayedSales.map(sale => (
                  <tr key={sale._id || sale.id} style={{ borderBottom: '1px solid #eee', ':hover': { backgroundColor: '#f9f9f9' } }}>
                    <td style={{ padding: '12px' }}><strong>{sale.folio}</strong></td>
                    <td style={{ padding: '12px' }}>{sale.customer?.nombre || 'N/A'}</td>
                    <td style={{ padding: '12px', fontWeight: 'bold', color: '#2c5aa0' }}>
                      ${sale.total ? sale.total.toFixed(2) : '0.00'}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        backgroundColor: sale.status === 'facturado' ? '#d4edda' : '#fff3cd',
                        color: sale.status === 'facturado' ? '#155724' : '#856404'
                      }}>
                        {sale.status || 'N/A'}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      {sale.saleDate ? new Date(sale.saleDate).toLocaleDateString('es-MX') : 'N/A'}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-block',
                        backgroundColor: sale.status === 'facturado' ? '#10b981' : '#f59e0b',
                        color: 'white',
                        padding: '0.35rem 0.85rem',
                        borderRadius: '20px',
                        fontSize: '0.8rem',
                        fontWeight: '500',
                        whiteSpace: 'nowrap',
                        textTransform: 'capitalize'
                      }}>
                        {sale.status === 'facturado' ? '✓ Timbrado' : sale.status || 'Pendiente'}
                      </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      {sale.status !== 'facturado' ? (
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                          <button
                            onClick={() => handleViewDetails(sale)}
                            style={{
                              padding: '5px 8px',
                              backgroundColor: '#6b7280',
                              color: 'white',
                              border: 'none',
                              borderRadius: '3px',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => e.target.style.backgroundColor = '#4b5563'}
                            onMouseOut={(e) => e.target.style.backgroundColor = '#6b7280'}
                            title="Ver detalles"
                          >
                            👁️
                          </button>
                          <button
                            onClick={() => navigate('/sale-to-invoice', { state: { selectedSale: sale } })}
                            style={{
                              padding: '5px 8px',
                              backgroundColor: '#10b981',
                              color: 'white',
                              border: 'none',
                              borderRadius: '3px',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => e.target.style.backgroundColor = '#059669'}
                            onMouseOut={(e) => e.target.style.backgroundColor = '#10b981'}
                            title="Facturar directamente"
                          >
                            🚀
                          </button>
                          <button
                            onClick={() => handleDelete(sale._id)}
                            style={{
                              padding: '5px 8px',
                              backgroundColor: '#ef4444',
                              color: 'whi te',
                              border: 'none',
                              borderRadius: '3px',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => e.target.style.backgroundColor = '#dc2626'}
                            onMouseOut={(e) => e.target.style.backgroundColor = '#ef4444'}
                            title="Eliminar venta"
                          >
                            🗑️
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleViewDetails(sale)}
                          style={{
                            padding: '5px 10px',
                            backgroundColor: '#9ca3af',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            transition: 'all 0.2s'
                          }}
                          onMouseOver={(e) => e.target.style.backgroundColor = '#6b7280'}
                          onMouseOut={(e) => e.target.style.backgroundColor = '#9ca3af'}
                          title="Ver detalles"
                        >
                          👁️
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '20px', flexWrap: 'wrap' }}>
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                style={{
                  padding: '8px 12px',
                  backgroundColor: currentPage === 1 ? '#ccc' : '#2c5aa0',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                }}
              >
                ◀◀ Primera
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={{
                  padding: '8px 12px',
                  backgroundColor: currentPage === 1 ? '#ccc' : '#2c5aa0',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                }}
              >
                ◀ Anterior
              </button>

              <span style={{ margin: '0 8px', fontSize: '14px', fontWeight: '600' }}>
                Página {currentPage} de {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                style={{
                  padding: '8px 12px',
                  backgroundColor: currentPage === totalPages ? '#ccc' : '#2c5aa0',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                }}
              >
                Siguiente ▶
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                style={{
                  padding: '8px 12px',
                  backgroundColor: currentPage === totalPages ? '#ccc' : '#2c5aa0',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                }}
              >
                Última ▶▶
              </button>
            </div>
          )}
        </div>
      )}

      {/* Sales Details Modal */}
      {showDetails && selectedSale && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={closeDetails}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '30px',
            maxWidth: '900px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            width: '90%'
          }} onClick={(e) => e.stopPropagation()}>
            {/* Print Styles */}
            <style>
              {`
                @media print {
                  .no-print { display: none; }
                  body { margin: 0; padding: 0; }
                  .print-content { width: 100%; }
                }
              `}
            </style>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0 }}>Detalles de Venta - Folio: {selectedSale.folio}</h2>
              <button
                onClick={closeDetails}
                style={{
                  backgroundColor: '#f0f0f0',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%'
                }}
              >
                ×
              </button>
            </div>

            {/* Print Content */}
            <div className="print-content">
              {/* Customer Info */}
              <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#2c5aa0' }}>Información del Cliente</h3>
                <p><strong>Nombre:</strong> {selectedSale.customer?.nombre || 'N/A'}</p>
                <p><strong>RFC:</strong> {selectedSale.customer?.rfc || 'N/A'}</p>
                <p><strong>Email:</strong> {selectedSale.customer?.email || 'N/A'}</p>
              </div>

              {/* Sale Info */}
              <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#2c5aa0' }}>Información de Venta</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <p><strong>Folio:</strong> {selectedSale.folio}</p>
                  <p><strong>Estado:</strong> <span style={{ backgroundColor: selectedSale.status === 'facturado' ? '#d4edda' : '#fff3cd', padding: '2px 6px', borderRadius: '3px' }}>{selectedSale.status || 'pendiente de facturar'}</span></p>
                  <p><strong>Fecha:</strong> {selectedSale.saleDate ? new Date(selectedSale.saleDate).toLocaleDateString('es-MX') : 'N/A'}</p>
                  <p><strong>Hora:</strong> {selectedSale.saleDate ? new Date(selectedSale.saleDate).toLocaleTimeString('es-MX') : 'N/A'}</p>
                  <p><strong>Método de Pago:</strong> {selectedSale.metodoPago || selectedSale.paymentMethod || 'PUE'}</p>
                  <p><strong>Forma de Pago:</strong> {selectedSale.formaPago || '01 - Efectivo'}</p>
                  <p><strong>Tipo de Venta:</strong> {selectedSale.salesType || selectedSale.source || 'pos'}</p>
                </div>
              </div>

              {/* Items */}
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#2c5aa0' }}>Productos ({selectedSale.items?.length || 0})</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ddd' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f0f0f0' }}>
                      <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Descripción</th>
                      <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>Cantidad</th>
                      <th style={{ padding: '10px', textAlign: 'right', borderBottom: '2px solid #ddd' }}>Precio Unit.</th>
                      <th style={{ padding: '10px', textAlign: 'right', borderBottom: '2px solid #ddd' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSale.items && Array.isArray(selectedSale.items) && selectedSale.items.length > 0 ? (
                      selectedSale.items.map((item, idx) => {
                        console.log(`Item ${idx}:`, item);
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '10px' }}>{item.descripcion || item.nombre || 'Producto'}</td>
                            <td style={{ padding: '10px', textAlign: 'center' }}>{item.cantidad || 1}</td>
                            <td style={{ padding: '10px', textAlign: 'right' }}>${(item.valorUnitario || 0).toFixed(2)}</td>
                            <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold' }}>${(item.importe || 0).toFixed(2)}</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="4" style={{ padding: '10px', textAlign: 'center', color: '#666' }}>
                          No hay productos registrados {selectedSale.items ? `(tipo: ${typeof selectedSale.items})` : ''}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#2c5aa0' }}>Resumen</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <p><strong>Subtotal:</strong></p>
                  <p style={{ textAlign: 'right' }}>${(selectedSale.total / 1.16)?.toFixed(2) || '0.00'}</p>
                  <p><strong>IVA (16%):</strong></p>
                  <p style={{ textAlign: 'right' }}>${(selectedSale.total - (selectedSale.total / 1.16))?.toFixed(2) || '0.00'}</p>
                  <p style={{ fontWeight: 'bold', fontSize: '1.1em' }}><strong>Total:</strong></p>
                  <p style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '1.1em', color: '#2c5aa0' }}>${selectedSale.total?.toFixed(2) || '0.00'}</p>
                </div>
              </div>

              {/* Notes */}
              {selectedSale.notes && (
                <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
                  <h3 style={{ margin: '0 0 10px 0', color: '#2c5aa0' }}>Notas</h3>
                  <p>{selectedSale.notes}</p>
                </div>
              )}

              {/* Debug Info */}
              <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f0f0f0', borderRadius: '4px', fontSize: '12px' }}>
                <details>
                  <summary style={{ cursor: 'pointer', fontWeight: 'bold', color: '#666' }}>📋 Ver Datos Completos (Debug)</summary>
                  <pre style={{ marginTop: '10px', overflow: 'auto', maxHeight: '300px', backgroundColor: '#fff', padding: '10px', borderRadius: '3px' }}>
                    {JSON.stringify(selectedSale, null, 2)}
                  </pre>
                </details>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="no-print" style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              {selectedSale.status !== 'facturado' && (
                <button
                  onClick={() => {
                    closeDetails();
                    navigate('/sale-to-invoice');
                  }}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  → Facturar Ahora
                </button>
              )}
              <button
                onClick={handlePrint}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                🖨️ Imprimir
              </button>
              <button
                onClick={() => handleDelete(selectedSale._id)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: deleteConfirm === selectedSale._id ? '#dc3545' : '#ff6b6b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                {deleteConfirm === selectedSale._id ? '⚠️ Confirmar Eliminar' : '🗑️ Eliminar'}
              </button>
              <button
                onClick={closeDetails}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ListSales;
