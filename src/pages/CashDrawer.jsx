import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { salesService, cashDrawerService } from '../services/api';

export default function CashDrawer() {
  const navigate = useNavigate();
  const [step, setStep] = useState('form'); // form, preview, success
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const [cutoffData, setCutoffData] = useState(null);

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
      const startDate = new Date(formData.startDate);
      const endDate = new Date(formData.endDate);
      endDate.setHours(23, 59, 59, 999);

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
      await cashDrawerService.saveCutoff(cutoffData);
      alert('✓ Corte de caja guardado exitosamente');
      navigate('/cash-drawers-list');
    } catch (err) {
      console.error('Error saving cutoff:', err);
      alert('Error al guardar el corte: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleNewCutoff = () => {
    setStep('form');
    setCutoffData(null);
    setFormData({
      startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
    });
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
              {new Date(cutoffData.startDate).toLocaleDateString('es-MX')} - {new Date(cutoffData.endDate).toLocaleDateString('es-MX')}
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
                      <td style={{ padding: '0.75rem' }}>{method}</td>
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
            <p><strong>Período:</strong> {new Date(cutoffData.startDate).toLocaleDateString('es-MX')} - {new Date(cutoffData.endDate).toLocaleDateString('es-MX')}</p>
          </div>
        </div>

        <div className="no-print" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
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

      <div className="card">
        <h3 style={{ marginBottom: '0.5rem' }}>Generar Corte de Caja</h3>
        <p style={{ color: 'var(--gray-500)', marginBottom: '1.5rem' }}>
          Realiza un corte de caja para revisar todas las ventas de un período específico, con desglose por forma de pago y estado.
        </p>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleGenerateCutoff} style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
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
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
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
          </div>
        </form>

        {/* Quick Shortcuts */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem'
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
              padding: '1rem',
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
              padding: '1rem',
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
              padding: '1rem',
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
    </>
  );
}
