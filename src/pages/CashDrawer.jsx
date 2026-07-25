import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { salesService, cashDrawerService, invoiceService, authService } from '../services/api';
import { useToast } from '../components/ui/Toast.jsx';

const PAYMENT_METHODS = {
  '01': 'Efectivo',
  '02': 'Cheque',
  '03': 'Transferencia',
  '04': 'Tarjeta de Crédito',
  '05': 'Monedero Electrónico',
  '06': 'Dinero Electrónico',
  '08': 'Vales',
  '12': 'Dación en Pago',
  '13': 'Pago por Subrogación',
  '14': 'Pago por Consignación',
  '15': 'Condonación',
  '17': 'Compensación',
  '23': 'Novación',
  '24': 'Confusión',
  '25': 'Remisión de Deuda',
  '26': 'Prescripción',
  '27': 'A Plazos',
  '28': 'Sin Identificar',
  '29': 'Crédito al Consumo',
  '30': 'Pago en Especie',
  'Efectivo': 'Efectivo',
  'Tarjeta': 'Tarjeta de Crédito',
  'Transferencia': 'Transferencia',
  'Cheque': 'Cheque',
};

const getPaymentMethodName = (code) => {
  if (!code) return 'Efectivo';
  return PAYMENT_METHODS[code] || code;
};

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

export default function CashDrawer() {
  const navigate = useNavigate();
  const [step, setStep] = useState('form'); // form, preview, success
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const toast = useToast();
  const [formData, setFormData] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const [cutoffData, setCutoffData] = useState(null);
  const [cutoffHistory, setCutoffHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [savedCutoffId, setSavedCutoffId] = useState(null);
  const [selectedCutoff, setSelectedCutoff] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const user = authService.getCurrentUser();
    setCurrentUser(user);
    loadCutoffHistory();
  }, []);

  const loadCutoffHistory = async () => {
    setHistoryLoading(true);
    try {
      const response = await cashDrawerService.getCutoffs({ limit: 100, page: 1 });
      setCutoffHistory(Array.isArray(response?.data) ? response.data : []);
    } catch (err) {
      console.error('Error loading cutoff history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleGenerateCutoff = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await salesService.getAllSales({ limit: 1000, page: 1 });
      const salesArray = Array.isArray(response) ? response : [];

      // Filter sales by date range
      const startDate = new Date(formData.startDate + 'T00:00:00');
      const endDate = new Date(formData.endDate + 'T23:59:59');

      const filteredSales = salesArray.filter(sale => {
        const saleDate = new Date(sale.saleDate);
        return saleDate >= startDate && saleDate <= endDate;
      });

      // Calculate totals
      const totalAmount = filteredSales.reduce((sum, sale) => sum + (sale.total || 0), 0);
      const subtotal = totalAmount / 1.16;
      const iva = totalAmount - subtotal;

      // Group by payment method
      const byPaymentMethod = {};
      filteredSales.forEach(sale => {
        const method = sale.formaPago || 'Efectivo';
        if (!byPaymentMethod[method]) {
          byPaymentMethod[method] = { count: 0, total: 0 };
        }
        byPaymentMethod[method].count += 1;
        byPaymentMethod[method].total += sale.total || 0;
      });

      // Group by status
      const byStatus = {};
      filteredSales.forEach(sale => {
        const status = sale.status || 'pendiente de facturar';
        if (!byStatus[status]) {
          byStatus[status] = { count: 0, total: 0 };
        }
        byStatus[status].count += 1;
        byStatus[status].total += sale.total || 0;
      });

      setCutoffData({
        startDate: formData.startDate,
        endDate: formData.endDate,
        generatedAt: new Date().toLocaleString('es-MX'),
        totalSales: filteredSales.length,
        totalAmount,
        subtotal,
        iva,
        byPaymentMethod,
        byStatus,
        sales: filteredSales,
      });

      setStep('preview');
    } catch (err) {
      console.error('Error generating cutoff:', err);
      setError('Error al generar el corte de caja: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSaveCutoff = async () => {
    setLoading(true);
    try {
      const response = await cashDrawerService.saveCutoff(cutoffData);
      setSavedCutoffId(response?.data?.id || response?._id);
      toast.success('Corte de caja guardado exitosamente');
      loadCutoffHistory();
      setStep('form');
      setCutoffData(null);
    } catch (err) {
      console.error('Error saving cutoff:', err);
      toast.error('Error al guardar el corte: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const buildNotasPartidas = (sales) => {
    if (!sales || !Array.isArray(sales) || sales.length === 0) {
      return [];
    }
    return sales.map(sale => ({
      cantidad: 1,
      pu: sale.total,
      Descripcion: `Venta ${sale.folio}`,
      CodigoSat: '01010101',
      ClaveUnidad: 'E48',
      Unidad: 'Servicio'
    }));
  };

  const handleGenerateInvoice = async () => {
    if (!cutoffData || !cutoffData.sales || cutoffData.sales.length === 0) {
      toast.warning('No hay ventas para facturar');
      return;
    }

    if (!savedCutoffId) {
      toast.warning('Debes guardar el corte antes de generar la factura');
      return;
    }

    setLoading(true);
    try {
      const invoiceData = {
        notasPartidas: buildNotasPartidas(cutoffData.sales),
        formaPago: '01',
        MetadoPago: 'PUE',
        UsoCFDI: 'G01',
        cashDrawerId: savedCutoffId,
        userId: currentUser?._id || currentUser?.id
      };

      console.log('📄 Invoice JSON to send:', JSON.stringify(invoiceData, null, 2));

      const response = await invoiceService.generateGlobal(invoiceData);
      console.log('✅ Full Invoice response:', JSON.stringify(response, null, 2));
      console.log('📋 Response data:', response?.data);
      console.log('🆔 Invoice ID:', response?.data?._id);
      console.log('⏰ Saved at:', response?.data?.savedAt);
      console.log('📄 UUID:', response?.data?.uuid);
      console.log('💰 Total:', response?.data?.Total);
      toast.success('Factura global generada exitosamente');
      navigate('/invoices');
    } catch (err) {
      console.error('Error generating invoice:', err);
      toast.error('Error al generar factura: ' + err.message);
    } finally {
      setLoading(false);
    }
  };


  const handleNewCutoff = () => {
    setStep('form');
    setCutoffData(null);
    setSavedCutoffId(null);
    setFormData({
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
    });
  };

  const handleQuickInvoice = async (historyCutoff) => {
    setLoading(true);
    try {
      let notasPartidas = buildNotasPartidas(historyCutoff.sales || []);

      // Fallback: if no sales data, create a single line item with the total
      if (!notasPartidas || notasPartidas.length === 0) {
        notasPartidas = [{
          cantidad: 1,
          pu: historyCutoff.totalAmount || 0,
          Descripcion: `Corte de caja ${formatDate(historyCutoff.startDate)}`,
          CodigoSat: '01010101',
          ClaveUnidad: 'E48',
          Unidad: 'Servicio'
        }];
      }

      const invoiceData = {
        notasPartidas,
        formaPago: '01',
        MetodoPago: 'PUE',
        UsoCFDI: 'G01',
        cashDrawerId: historyCutoff._id,
        userId: currentUser?._id || currentUser?.id
      };

      console.log('📄 Invoice JSON to send:', JSON.stringify(invoiceData, null, 2));

      const response = await invoiceService.generateGlobal(invoiceData);
      console.log('✅ Full Invoice response:', JSON.stringify(response, null, 2));
      console.log('📋 Response data:', response?.data);
      console.log('🆔 Invoice ID:', response?.data?._id);
      console.log('⏰ Saved at:', response?.data?.savedAt);
      console.log('📄 UUID:', response?.data?.uuid);
      console.log('💰 Total:', response?.data?.Total);
      toast.success('Factura global generada exitosamente');
      navigate('/invoices');
    } catch (err) {
      console.error('Error generating invoice:', err);
      toast.error('Error al generar factura: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (cutoff) => {
    setSelectedCutoff(cutoff);
  };

  const handleDeleteCutoff = async (cutoffId) => {
    setLoading(true);
    try {
      await cashDrawerService.deleteCutoff(cutoffId);
      toast.success('Corte eliminado exitosamente');
      loadCutoffHistory();
      setShowDeleteConfirm(null);
    } catch (err) {
      console.error('Error deleting cutoff:', err);
      toast.error('Error al eliminar corte: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (step === 'preview' && cutoffData) {
    return (
      <div style={{ padding: '2rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <button
              onClick={handleNewCutoff}
              style={{
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                padding: '0.5rem 1rem',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              ← Nuevo Corte
            </button>
          </div>

          <div className="card no-print" style={{ marginBottom: '2rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🧾</div>
            <h2>Corte de Caja</h2>
            <p style={{ color: 'var(--gray-500)', marginTop: '0.5rem' }}>
              {formatDate(cutoffData.startDate)} - {formatDate(cutoffData.endDate)}
            </p>
          </div>

          <div style={{
            border: '2px solid var(--primary-color)',
            borderRadius: '8px',
            padding: '2rem',
            marginBottom: '2rem',
            backgroundColor: 'var(--primary-color)',
            color: 'white'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              <div>
                <p style={{ color: 'rgba(255,255,255,0.8)', marginBottom: '0.25rem' }}>Total de Ventas</p>
                <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                  ${cutoffData.totalAmount.toFixed(2)}
                </div>
              </div>
              <div>
                <p style={{ color: 'rgba(255,255,255,0.8)', marginBottom: '0.25rem' }}>Número de Transacciones</p>
                <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                  {cutoffData.totalSales}
                </div>
              </div>
            </div>
          </div>

          {/* Listado de Ventas */}
          <div style={{
            border: '1px solid var(--gray-200)',
            borderRadius: '8px',
            padding: '1.5rem',
            marginBottom: '2rem'
          }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--primary-color)' }}>
              Detalle de Ventas ({cutoffData.sales?.length || 0})
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.9rem'
              }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--gray-100)', borderBottom: '2px solid var(--gray-300)' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Folio</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Fecha</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Forma de Pago</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Estado</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {cutoffData.sales?.map((sale, idx) => (
                    <tr key={idx} style={{
                      borderBottom: '1px solid var(--gray-200)',
                      backgroundColor: idx % 2 === 0 ? 'white' : 'var(--gray-50)'
                    }}>
                      <td style={{ padding: '0.75rem' }}>
                        {sale.folio || sale._id?.slice(-6) || `#${idx + 1}`}
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        {formatDate(sale.saleDate)}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                        {getPaymentMethodName(sale.formaPago)}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-block',
                          backgroundColor: sale.status === 'facturado' ? '#10b981' : '#f59e0b',
                          color: 'white',
                          padding: '0.25rem 0.75rem',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: '500'
                        }}>
                          {sale.status === 'facturado' ? '✓' : '⏳'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold' }}>
                        ${(sale.total || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Desglose por forma de pago */}
          <div style={{
            border: '1px solid var(--gray-200)',
            borderRadius: '8px',
            padding: '1.5rem',
            marginBottom: '2rem'
          }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--primary-color)' }}>
              Desglose por Forma de Pago
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse'
              }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--gray-100)', borderBottom: '2px solid var(--gray-300)' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Forma de Pago</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Transacciones</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Total</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>% del Total</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(cutoffData.byPaymentMethod).map(([method, data], idx) => (
                    <tr key={idx} style={{
                      borderBottom: '1px solid var(--gray-200)',
                      backgroundColor: idx % 2 === 0 ? 'white' : 'var(--gray-50)'
                    }}>
                      <td style={{ padding: '0.75rem' }}>{getPaymentMethodName(method)}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>{data.count}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold' }}>
                        ${data.total.toFixed(2)}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        {((data.total / cutoffData.totalAmount) * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Desglose por estado */}
          <div style={{
            border: '1px solid var(--gray-200)',
            borderRadius: '8px',
            padding: '1.5rem',
            marginBottom: '2rem'
          }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--primary-color)' }}>
              Desglose por Estado
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse'
              }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--gray-100)', borderBottom: '2px solid var(--gray-300)' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Estado</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Cantidad</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(cutoffData.byStatus).map(([status, data], idx) => (
                    <tr key={idx} style={{
                      borderBottom: '1px solid var(--gray-200)',
                      backgroundColor: idx % 2 === 0 ? 'white' : 'var(--gray-50)'
                    }}>
                      <td style={{ padding: '0.75rem' }}>
                        <span style={{
                          display: 'inline-block',
                          backgroundColor: status === 'facturado' ? '#10b981' : '#f59e0b',
                          color: 'white',
                          padding: '0.25rem 0.75rem',
                          borderRadius: '12px',
                          fontSize: '0.8rem',
                          fontWeight: '500'
                        }}>
                          {status === 'facturado' ? '✓ Timbrado' : '⏳ ' + status}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>{data.count}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold' }}>
                        ${data.total.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Resumen */}
          <div style={{
            border: '1px solid var(--gray-200)',
            borderRadius: '8px',
            padding: '1.5rem',
            marginBottom: '2rem',
            backgroundColor: 'var(--gray-50)'
          }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--primary-color)' }}>Resumen Fiscal</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <p style={{ color: 'var(--gray-600)', marginBottom: '0.25rem' }}>Subtotal</p>
                <p style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                  ${cutoffData.subtotal.toFixed(2)}
                </p>
              </div>
              <div>
                <p style={{ color: 'var(--gray-600)', marginBottom: '0.25rem' }}>IVA (16%)</p>
                <p style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                  ${cutoffData.iva.toFixed(2)}
                </p>
              </div>
              <div style={{ gridColumn: '1 / -1', borderTop: '2px solid var(--gray-300)', paddingTop: '1rem' }}>
                <p style={{ color: 'var(--gray-600)', marginBottom: '0.25rem' }}>Total</p>
                <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>
                  ${cutoffData.totalAmount.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          {/* Información del corte */}
          <div style={{
            border: '1px solid var(--gray-200)',
            borderRadius: '8px',
            padding: '1rem',
            backgroundColor: 'var(--gray-50)',
            fontSize: '0.9rem',
            color: 'var(--gray-600)'
          }}>
            <p><strong>Generado:</strong> {cutoffData.generatedAt}</p>
            <p><strong>Período:</strong> {formatDate(cutoffData.startDate)} - {formatDate(cutoffData.endDate)}</p>
          </div>
        </div>

        <div className="no-print" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem' }}>
          <button
            onClick={handleNewCutoff}
            style={{
              backgroundColor: 'var(--primary-color)',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: '500',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.target.style.backgroundColor = '#2563eb';
              e.target.style.transform = 'translateY(-1px)';
            }}
            onMouseOut={(e) => {
              e.target.style.backgroundColor = 'var(--primary-color)';
              e.target.style.transform = 'translateY(0)';
            }}
          >
            ← Nuevo Corte
          </button>
          <button
            onClick={handleGenerateInvoice}
            disabled={loading || !savedCutoffId}
            style={{
              backgroundColor: savedCutoffId ? '#f59e0b' : '#d1d5db',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '4px',
              cursor: loading || !savedCutoffId ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              fontWeight: '500',
              transition: 'all 0.2s',
              opacity: loading || !savedCutoffId ? 0.7 : 1
            }}
            onMouseOver={(e) => {
              if (!loading && savedCutoffId) {
                e.target.style.backgroundColor = '#d97706';
                e.target.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseOut={(e) => {
              e.target.style.backgroundColor = savedCutoffId ? '#f59e0b' : '#d1d5db';
              e.target.style.transform = 'translateY(0)';
            }}
          >
            {loading ? '📄 Generando...' : !savedCutoffId ? '📄 Guardar primero' : '📄 Factura Global'}
          </button>
          <button
            onClick={handleSaveCutoff}
            disabled={loading}
            style={{
              backgroundColor: '#8b5cf6',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              fontWeight: '500',
              transition: 'all 0.2s',
              opacity: loading ? 0.7 : 1
            }}
            onMouseOver={(e) => {
              if (!loading) {
                e.target.style.backgroundColor = '#7c3aed';
                e.target.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseOut={(e) => {
              e.target.style.backgroundColor = '#8b5cf6';
              e.target.style.transform = 'translateY(0)';
            }}
          >
            {loading ? '💾 Guardando...' : '💾 Guardar Corte'}
          </button>
          <button
            onClick={handlePrint}
            style={{
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: '500',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.target.style.backgroundColor = '#059669';
              e.target.style.transform = 'translateY(-1px)';
            }}
            onMouseOut={(e) => {
              e.target.style.backgroundColor = '#10b981';
              e.target.style.transform = 'translateY(0)';
            }}
          >
            🖨️ Imprimir / Descargar
          </button>
        </div>

        <style>{`
          @media print {
            .no-print { display: none; }
            body { margin: 0; padding: 0; }
            .card { box-shadow: none; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <>
      <h2 style={{ marginBottom: '1.5rem' }}>Corte de Caja</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* Left: Generate Form */}
        <div className="card">
          <h3 style={{ marginBottom: '0.5rem' }}>Generar Corte de Caja</h3>
          <p style={{ color: 'var(--gray-500)', marginBottom: '1.5rem' }}>
            Realiza un corte de caja para revisar todas las ventas de un período específico, con desglose por forma de pago y estado.
          </p>

          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleGenerateCutoff} style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'grid', gap: '1rem', marginBottom: '1.5rem' }}>
              <div className="form-group">
                <label htmlFor="startDate">Fecha Inicial *</label>
                <input
                  type="date"
                  id="startDate"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="endDate">Fecha Final *</label>
                <input
                  type="date"
                  id="endDate"
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '4px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600',
                  opacity: loading ? 0.7 : 1
                }}
              >
                {loading ? '⏳ Generando...' : '✓ Generar Corte'}
              </button>
            </div>
          </form>

          {/* Quick Shortcuts */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: '0.75rem'
          }}>
            <button
              onClick={() => {
                const today = new Date();
                setFormData({
                  startDate: today.toISOString().split('T')[0],
                  endDate: today.toISOString().split('T')[0],
                });
              }}
              style={{
                padding: '0.75rem',
                backgroundColor: 'var(--gray-100)',
                border: '1px solid var(--gray-300)',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                e.target.style.backgroundColor = 'var(--gray-200)';
              }}
              onMouseOut={(e) => {
                e.target.style.backgroundColor = 'var(--gray-100)';
              }}
            >
              📅 Hoy
            </button>
            <button
              onClick={() => {
                const today = new Date();
                const startOfWeek = new Date(today);
                startOfWeek.setDate(today.getDate() - today.getDay());
                setFormData({
                  startDate: startOfWeek.toISOString().split('T')[0],
                  endDate: today.toISOString().split('T')[0],
                });
              }}
              style={{
                padding: '0.75rem',
                backgroundColor: 'var(--gray-100)',
                border: '1px solid var(--gray-300)',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                e.target.style.backgroundColor = 'var(--gray-200)';
              }}
              onMouseOut={(e) => {
                e.target.style.backgroundColor = 'var(--gray-100)';
              }}
            >
              📆 Esta Semana
            </button>
            <button
              onClick={() => {
                const today = new Date();
                const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                setFormData({
                  startDate: startOfMonth.toISOString().split('T')[0],
                  endDate: today.toISOString().split('T')[0],
                });
              }}
              style={{
                padding: '0.75rem',
                backgroundColor: 'var(--gray-100)',
                border: '1px solid var(--gray-300)',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                e.target.style.backgroundColor = 'var(--gray-200)';
              }}
              onMouseOut={(e) => {
                e.target.style.backgroundColor = 'var(--gray-100)';
              }}
            >
              📊 Este Mes
            </button>
          </div>
        </div>

        {/* Right: History Table */}
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>Historial de Cortes</h3>
          {historyLoading ? (
            <p style={{ color: 'var(--gray-500)', textAlign: 'center', padding: '2rem' }}>Cargando...</p>
          ) : cutoffHistory.length === 0 ? (
            <p style={{ color: 'var(--gray-500)', textAlign: 'center', padding: '2rem' }}>No hay cortes guardados aún</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.85rem'
              }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--gray-100)', borderBottom: '2px solid var(--gray-300)' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Período</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Ventas</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Subtotal</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>IVA</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Total</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {cutoffHistory.map((cutoff, idx) => (
                    <tr key={idx} style={{
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
                      <td style={{ padding: '0.75rem' }}>
                        {formatDate(cutoff.startDate)}
                        {cutoff.endDate && cutoff.startDate !== cutoff.endDate && (
                          <> - {new Date(cutoff.endDate + 'T00:00:00').toLocaleDateString('es-MX')}</>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                        {cutoff.totalSales || 0}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        ${(cutoff.subtotal || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        ${(cutoff.iva || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold' }}>
                        ${(cutoff.totalAmount || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                          <button
                            onClick={() => handleViewDetails(cutoff)}
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
                          <button
                            onClick={() => handleQuickInvoice(cutoff)}
                            disabled={loading}
                            style={{
                              padding: '0.4rem 0.75rem',
                              backgroundColor: '#f59e0b',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              cursor: loading ? 'not-allowed' : 'pointer',
                              opacity: loading ? 0.7 : 1,
                              transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => {
                              if (!loading) {
                                e.target.style.backgroundColor = '#d97706';
                              }
                            }}
                            onMouseOut={(e) => {
                              e.target.style.backgroundColor = '#f59e0b';
                            }}
                          >
                            📄 Factura
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(cutoff._id)}
                            disabled={loading}
                            style={{
                              padding: '0.4rem 0.75rem',
                              backgroundColor: '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              cursor: loading ? 'not-allowed' : 'pointer',
                              opacity: loading ? 0.7 : 1,
                              transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => {
                              if (!loading) {
                                e.target.style.backgroundColor = '#dc2626';
                              }
                            }}
                            onMouseOut={(e) => {
                              e.target.style.backgroundColor = '#ef4444';
                            }}
                          >
                            🗑️ Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Details Modal */}
        {selectedCutoff && (
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
          onClick={() => setSelectedCutoff(null)}
          >
            <div style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '2rem',
              maxWidth: '600px',
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
            }}
            onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3>Detalles del Corte</h3>
                <button
                  onClick={() => setSelectedCutoff(null)}
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
                <div>
                  <p style={{ color: 'var(--gray-600)', fontSize: '0.9rem' }}>Período</p>
                  <p style={{ fontSize: '1.1rem', fontWeight: '600' }}>
                    {formatDate(selectedCutoff.startDate)}
                  </p>
                </div>
                <div>
                  <p style={{ color: 'var(--gray-600)', fontSize: '0.9rem' }}>Total de Ventas</p>
                  <p style={{ fontSize: '1.1rem', fontWeight: '600' }}>{selectedCutoff.totalSales || 0}</p>
                </div>
                <div>
                  <p style={{ color: 'var(--gray-600)', fontSize: '0.9rem' }}>Subtotal</p>
                  <p style={{ fontSize: '1.1rem', fontWeight: '600' }}>${(selectedCutoff.subtotal || 0).toFixed(2)}</p>
                </div>
                <div>
                  <p style={{ color: 'var(--gray-600)', fontSize: '0.9rem' }}>IVA (16%)</p>
                  <p style={{ fontSize: '1.1rem', fontWeight: '600' }}>${(selectedCutoff.iva || 0).toFixed(2)}</p>
                </div>
                <div>
                  <p style={{ color: 'var(--gray-600)', fontSize: '0.9rem' }}>Total</p>
                  <p style={{ fontSize: '1.3rem', fontWeight: '700', color: 'var(--primary-color)' }}>
                    ${(selectedCutoff.totalAmount || 0).toFixed(2)}
                  </p>
                </div>
              </div>

              {selectedCutoff.byPaymentMethod && Object.keys(selectedCutoff.byPaymentMethod).length > 0 && (
                <div style={{ marginBottom: '2rem' }}>
                  <h4 style={{ marginBottom: '1rem' }}>Por Forma de Pago</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {Object.entries(selectedCutoff.byPaymentMethod).map(([method, data], idx) => (
                      <div key={idx} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '0.75rem',
                        backgroundColor: 'var(--gray-50)',
                        borderRadius: '4px'
                      }}>
                        <span>{getPaymentMethodName(method)}</span>
                        <span style={{ fontWeight: '600' }}>${(data.total || 0).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setSelectedCutoff(null)}
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
                <button
                  onClick={() => {
                    handleQuickInvoice(selectedCutoff);
                    setSelectedCutoff(null);
                  }}
                  disabled={loading}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#f59e0b',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontWeight: '600',
                    opacity: loading ? 0.7 : 1
                  }}
                >
                  📄 Generar Factura
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
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
          onClick={() => setShowDeleteConfirm(null)}
          >
            <div style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '2rem',
              maxWidth: '400px',
              boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
            }}
            onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ marginBottom: '1rem', color: '#ef4444' }}>¿Eliminar Corte?</h3>
              <p style={{ color: 'var(--gray-600)', marginBottom: '2rem' }}>
                Esta acción no se puede deshacer. ¿Estás seguro de que deseas eliminar este corte de caja?
              </p>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: 'var(--gray-200)',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleDeleteCutoff(showDeleteConfirm)}
                  disabled={loading}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontWeight: '600',
                    opacity: loading ? 0.7 : 1
                  }}
                >
                  {loading ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
