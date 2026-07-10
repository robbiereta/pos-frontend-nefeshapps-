import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { salesService, invoiceService, userService } from '../services/api';

export default function SaleToInvoice() {
  const location = useLocation();
  const saleFromLocation = location.state?.selectedSale;
  const [sales, setSales] = useState([]);
  const [selectedSale, setSelectedSale] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingSales, setLoadingSales] = useState(true);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [progress, setProgress] = useState('');
  const [step, setStep] = useState('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const [showInvoicePrint, setShowInvoicePrint] = useState(false);

  useEffect(() => {
    fetchSales();
    // Si la venta viene del router, preseleccionarla e ir al preview
    if (saleFromLocation) {
      setSelectedSale(saleFromLocation);
      setStep('preview');
    }
  }, []);

  const fetchSales = async () => {
    try {
      setLoadingSales(true);
      setError(null);
      console.log('Fetching sales...');
      const data = await salesService.getAllSales({ limit: 100, page: 1 });
      console.log('Sales data received:', data);

      let salesArray = [];
      if (Array.isArray(data)) {
        salesArray = data;
      } else if (data && typeof data === 'object') {
        // Si es un objeto, intentar extraer el array
        salesArray = data.sales || data.items || Object.values(data).find(v => Array.isArray(v)) || [];
      }

      console.log('Parsed sales:', salesArray);
      setSales(salesArray);
    } catch (err) {
      console.error('Error fetching sales:', err);
      setError('Error al cargar las ventas: ' + err.message);
      setSales([]);
    } finally {
      setLoadingSales(false);
    }
  };

  const filteredSales = sales.filter(sale => {
    const matchesSearch = !searchTerm ||
      sale.folio?.includes(searchTerm) ||
      sale.customer?.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.customer?.rfc?.includes(searchTerm);

    const matchesFilter = filter === 'all' || sale.status === filter;

    return matchesSearch && matchesFilter;
  });

  const handleSelectSale = (sale) => {
    setSelectedSale(sale);
    setStep('preview');
    setError(null);
  };

  const handleConvertToInvoice = async () => {
    if (!selectedSale) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setStep('processing');

    try {
      setProgress('Construyendo factura desde la venta...');
      const invoicePayload = {
        notasPartidas: selectedSale.items.map(item => ({
          pu: item.valorUnitario,
          cantidad: item.cantidad,
          Descripcion: item.descripcion,
          CodigoSat: item.claveProdServ,
          ClaveUnidad: item.claveUnidad,
          Unidad: item.unidad
        })),
        receptorRfc: selectedSale.customer.rfc,
        receptorNombre: selectedSale.customer.nombre,
        receptorRegimen: selectedSale.customer.regimenFiscalReceptor,
        DomicilioFiscalReceptor: selectedSale.customer.domicilioFiscalReceptor,
        UsoCFDI: selectedSale.customer.usoCFDI,
        folio: selectedSale.folio || '',
        formaPago: selectedSale.formaPago,
        MetodoPago: selectedSale.metodoPago
      };

      const invoiceData = await invoiceService.generateClient(invoicePayload);

      console.log('📄 Invoice response from API:', JSON.stringify(invoiceData, null, 2));
      console.log('💾 Invoice data object:', invoiceData?.data);
      console.log('💰 Total value:', invoiceData?.data?.Total);
      console.log('💰 Total type:', typeof invoiceData?.data?.Total);

      if (!invoiceData.data) {
        throw new Error('La factura no se generó correctamente');
      }

      // Generate PDF from JSON invoice data
      let pdfUrl = null;
      setProgress('Generando PDF de la factura...');
      try {
        console.group('📄 PDF Generation from JSON');
        console.log('🔄 Starting PDF generation...');
        console.log('📋 Invoice Data to PDF:', {
          Folio: invoiceData.data?.Folio,
          Fecha: invoiceData.data?.Fecha,
          Total: invoiceData.data?.Total,
          SubTotal: invoiceData.data?.SubTotal,
          Emisor: invoiceData.data?.Emisor?.Nombre,
          Receptor: invoiceData.data?.Receptor?.Nombre,
          ConceptosCount: invoiceData.data?.Conceptos?.length
        });
        console.log('📦 Full JSON Payload:', JSON.stringify(invoiceData.data, null, 2));

        // Send JSON invoice data directly to PDF endpoint
        const pdfPayload = JSON.stringify({
          invoiceJson: invoiceData.data,
          metadata: {
            source: 'SaleToInvoice',
            timestamp: new Date().toISOString()
          }
        });

        console.log('🚀 Sending PDF request with JSON payload...');
        console.log('📤 Payload size:', pdfPayload.length, 'bytes');
        pdfUrl = await invoiceService.generatePDF(pdfPayload);

        console.log('✅ PDF generated successfully');
        console.log('🔗 PDF URL:', pdfUrl);
        console.log('📏 PDF URL length:', pdfUrl?.length);
        console.log('🔍 PDF URL type:', typeof pdfUrl);

        if (!pdfUrl) {
          console.warn('⚠️  PDF URL is empty!');
        }

        console.groupEnd();
      } catch (pdfErr) {
        console.error('❌ PDF generation error:', {
          message: pdfErr.message,
          stack: pdfErr.stack,
          invoiceDataKeys: Object.keys(invoiceData.data || {})
        });
        console.warn('⚠️  PDF generation warning:', pdfErr.message);
        console.groupEnd();
      }
      setProgress('');
      console.log('📊 Final Result State:', {
        hasPdfUrl: !!pdfUrl,
        pdfUrl: pdfUrl?.substring(0, 100),
        invoiceFolio: invoiceData.data?.Folio,
        invoiceTotal: invoiceData.data?.Total
      });
      setResult({
        sale: selectedSale,
        invoice: invoiceData.data,
        pdfUrl: pdfUrl,
        pdfError: pdfUrl ? null : 'PDF generation failed - check console logs',
        stamped: null,
        uuid: null,
        cfdi: null,
      });

      setStep('confirm');
    } catch (err) {
      console.error('Conversion error:', err);
      setError(err.message || 'Error al convertir la venta a factura');
      setStep('error');
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  const handleConfirmStamping = async () => {
    if (!result?.invoice) return;

    setLoading(true);
    setError(null);
    setStep('processing');

    try {
      setProgress('Obteniendo configuración SW.com.mx...');

      const emisorConfig = await userService.getEmisorConfig();
      const swToken = emisorConfig.data?.emisorConfig?.sw_config?.tokenProd;
      const swEmail = emisorConfig.data?.emisorConfig?.sw_config?.email ||
                      emisorConfig.data?.emisorConfig?.emailFacturacion;

      if (!swToken) {
        throw new Error('No se encontró token SW.com.mx en la configuración. Verifica la configuración de emisor.');
      }

      setProgress('Timbrando factura con SW.com.mx...');

      const stampPayload = {
        invoiceData: result.invoice,
        token: swToken,
        email: swEmail
      };

      const stampedResponse = await invoiceService.stampInvoice(stampPayload);

      setProgress('Generando PDF del CFDI timbrado...');

      const cfdiXml = stampedResponse.data?.data?.cfdi;
      let stampedPdfResponse = null;

      if (cfdiXml) {
        try {
          stampedPdfResponse = await invoiceService.generatePDF(cfdiXml);
        } catch (pdfErr) {
          console.warn('PDF generation failed, but invoice was stamped:', pdfErr.message);
        }
      }

      setProgress('');
      setResult(prev => ({
        ...prev,
        stamped: stampedResponse.data,
        uuid: stampedResponse.data?.data?.uuid || stampedResponse.data?.uuid,
        cfdi: stampedResponse.data?.data?.cfdi,
        pdf: stampedPdfResponse?.data || prev.pdf,
      }));

      setStep('success');
      fetchSales();
    } catch (err) {
      console.error('Stamping error:', err);
      setError(err.message || 'Error al timbrar la factura');
      setStep('error');
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  // PDF PREVIEW MODAL (rendered as overlay on top of any step)
  if (showInvoicePrint && result?.pdfUrl) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: '#1e293b',
        zIndex: 2000
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.75rem 1rem',
          backgroundColor: '#0f172a',
          color: 'white',
          borderBottom: '2px solid #334155'
        }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>Vista Previa - Folio {result.invoice?.Folio || ''}</h3>
          <button
            onClick={() => setShowInvoicePrint(false)}
            style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '0.5rem 1.25rem', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}
          >
            ✕ Cerrar
          </button>
        </div>
        <iframe
          src={result.pdfUrl}
          style={{ width: '100%', height: 'calc(100vh - 52px)', border: 'none', backgroundColor: '#fff' }}
          title="PDF Preview"
        />
      </div>
    );
  }



  // PREVIEW VIEW
  if (step === 'preview') {
    return (
      <div style={{ padding: '2rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <button
            onClick={() => {
              setStep('list');
              setSelectedSale(null);
            }}
            style={{
              backgroundColor: 'var(--gray-500)',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            ← Volver a lista
          </button>
        </div>

        <div className="card">
          <h2 style={{ marginBottom: '1.5rem' }}>Vista previa de factura</h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
            <div style={{
              border: '1px solid var(--gray-200)',
              borderRadius: '4px',
              padding: '1rem',
              backgroundColor: 'var(--gray-50)'
            }}>
              <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Datos de la Venta</h3>
              <p><strong>ID:</strong> {selectedSale.id}</p>
              <p><strong>Folio:</strong> {selectedSale.folio || 'N/A'}</p>
              <p><strong>Fecha:</strong> {new Date(selectedSale.saleDate).toLocaleDateString()}</p>
              <p><strong>Estado:</strong> {selectedSale.status}</p>
              <p><strong>Total:</strong> ${selectedSale.total?.toFixed(2)}</p>
            </div>

            <div style={{
              border: '1px solid var(--gray-200)',
              borderRadius: '4px',
              padding: '1rem',
              backgroundColor: 'var(--gray-50)'
            }}>
              <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Datos del Cliente</h3>
              <p><strong>Nombre:</strong> {selectedSale.customer?.nombre}</p>
              <p><strong>RFC:</strong> {selectedSale.customer?.rfc}</p>
              <p><strong>Régimen:</strong> {selectedSale.customer?.regimenFiscalReceptor}</p>
              <p><strong>Código Postal:</strong> {selectedSale.customer?.domicilioFiscalReceptor}</p>
              <p><strong>Uso CFDI:</strong> {selectedSale.customer?.usoCFDI}</p>
            </div>
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Conceptos ({selectedSale.items?.length || 0})</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                backgroundColor: 'white',
                border: '1px solid var(--gray-200)'
              }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--gray-100)' }}>
                    <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--gray-300)' }}>Descripción</th>
                    <th style={{ padding: '0.5rem', textAlign: 'center', borderBottom: '1px solid var(--gray-300)' }}>Cantidad</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '1px solid var(--gray-300)' }}>Precio</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '1px solid var(--gray-300)' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedSale.items?.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--gray-200)' }}>
                      <td style={{ padding: '0.5rem' }}>{item.descripcion}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'center' }}>{item.cantidad}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'right' }}>${item.valorUnitario?.toFixed(2)}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 'bold' }}>
                        ${(item.cantidad * item.valorUnitario)?.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{
            border: '1px solid var(--gray-200)',
            borderRadius: '4px',
            padding: '1rem',
            marginBottom: '2rem',
            backgroundColor: 'var(--gray-50)'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <div>
                <span style={{ color: 'var(--gray-600)' }}>Subtotal:</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                  ${(selectedSale.total / 1.16)?.toFixed(2)}
                </div>
              </div>
              <div>
                <span style={{ color: 'var(--gray-600)' }}>IVA (16%):</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                  ${(selectedSale.total - (selectedSale.total / 1.16))?.toFixed(2)}
                </div>
              </div>
              <div>
                <span style={{ color: 'var(--gray-600)' }}>Total:</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>
                  ${selectedSale.total?.toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <button
              onClick={() => {
                setStep('list');
                setSelectedSale(null);
              }}
              style={{
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                padding: '0.85rem 1.75rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: '500',
                transition: 'all 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}
              onMouseOver={(e) => {
                e.target.style.backgroundColor = '#4b5563';
                e.target.style.boxShadow = '0 4px 6px rgba(0,0,0,0.15)';
                e.target.style.transform = 'translateY(-1px)';
              }}
              onMouseOut={(e) => {
                e.target.style.backgroundColor = '#6b7280';
                e.target.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                e.target.style.transform = 'translateY(0)';
              }}
            >
              Cancelar
            </button>
            <button
              onClick={handleConvertToInvoice}
              disabled={loading}
              style={{
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                padding: '0.85rem 1.75rem',
                borderRadius: '6px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '1rem',
                fontWeight: '600',
                transition: 'all 0.2s',
                boxShadow: '0 4px 6px rgba(59, 130, 246, 0.3)',
                opacity: loading ? 0.7 : 1,
                transform: loading ? 'scale(0.98)' : 'scale(1)'
              }}
              onMouseOver={(e) => {
                if (!loading) {
                  e.target.style.backgroundColor = '#2563eb';
                  e.target.style.boxShadow = '0 6px 12px rgba(59, 130, 246, 0.4)';
                  e.target.style.transform = 'translateY(-2px)';
                }
              }}
              onMouseOut={(e) => {
                e.target.style.backgroundColor = '#3b82f6';
                e.target.style.boxShadow = '0 4px 6px rgba(59, 130, 246, 0.3)';
                e.target.style.transform = 'translateY(0)';
              }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <span style={{
                    display: 'inline-block',
                    width: '14px',
                    height: '14px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTop: '2px solid white',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite'
                  }} />
                  Procesando...
                </span>
              ) : (
                '✓ Generar y Timbrar Factura'
              )}
            </button>
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        </div>
      </div>
    );
  }

  // CONFIRM VIEW
  if (step === 'confirm') {
    return (
      <div style={{ padding: '2rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <button
            onClick={() => {
              setStep('preview');
              setResult(null);
            }}
            style={{
              backgroundColor: 'var(--gray-500)',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            ← Volver a lista
          </button>
        </div>

        <div className="card">
          <h2 style={{ marginBottom: '1.5rem' }}>Confirmar Timbrado de Factura</h2>

          {error && <div className="error-message">{error}</div>}

          <div style={{
            backgroundColor: '#fff3cd',
            border: '1px solid #ffc107',
            color: '#856404',
            padding: '1rem',
            borderRadius: '4px',
            marginBottom: '1.5rem'
          }}>
            <strong>⚠️ Importante:</strong> Una vez timbrada la factura no podrá ser modificada y tendrá un costo asociado a través de SW.com.mx.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
            <div style={{
              border: '1px solid var(--gray-200)',
              borderRadius: '4px',
              padding: '1rem',
              backgroundColor: 'var(--gray-50)'
            }}>
              <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Resumen de Factura</h3>
              <p><strong>Cliente:</strong> {result.invoice?.Receptor?.Nombre}</p>
              <p><strong>RFC:</strong> {result.invoice?.Receptor?.Rfc}</p>
              <p><strong>Total:</strong> ${parseFloat(result.invoice?.Total || 0).toFixed(2)}</p>
              <p><strong>Conceptos:</strong> {result.invoice?.Conceptos?.length || 0}</p>
              <p><strong>Forma de Pago:</strong> {result.invoice?.FormaPago}</p>
              <p><strong>Método de Pago:</strong> {result.invoice?.MetodoPago}</p>
            </div>

            <div style={{
              border: '1px solid var(--gray-200)',
              borderRadius: '4px',
              padding: '1rem',
              backgroundColor: 'var(--gray-50)',
              textAlign: 'center'
            }}>
              <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Acciones</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <button
                  onClick={() => window.print()}
                  style={{
                    backgroundColor: '#10b981',
                    color: 'white',
                    padding: '0.5rem 1rem',
                    borderRadius: '4px',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: '500'
                  }}
                >
                  🖨️ Imprimir / Descargar
                </button>
                <button
                  onClick={() => setShowInvoicePrint(true)}
                  style={{
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    padding: '0.5rem 1rem',
                    borderRadius: '4px',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: '500'
                  }}
                >
                  👁️ Vista Previa
                </button>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Conceptos</h3>
            <div style={{ overflowX: 'auto', maxHeight: '300px', overflowY: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                backgroundColor: 'white',
                border: '1px solid var(--gray-200)'
              }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--gray-100)' }}>
                  <tr>
                    <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--gray-300)' }}>Descripción</th>
                    <th style={{ padding: '0.5rem', textAlign: 'center', borderBottom: '1px solid var(--gray-300)' }}>Cantidad</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '1px solid var(--gray-300)' }}>Precio</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '1px solid var(--gray-300)' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {result.invoice?.Conceptos?.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--gray-200)' }}>
                      <td style={{ padding: '0.5rem' }}>{item.Descripcion}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'center' }}>{item.Cantidad}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'right' }}>${parseFloat(item.ValorUnitario || 0).toFixed(2)}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 'bold' }}>
                        ${parseFloat(item.Importe || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <button
              onClick={() => {
                setStep('preview');
                setResult(null);
              }}
              disabled={loading}
              style={{
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                padding: '0.85rem 1.75rem',
                borderRadius: '6px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '1rem',
                fontWeight: '500',
                transition: 'all 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                opacity: loading ? 0.6 : 1
              }}
              onMouseOver={(e) => {
                if (!loading) {
                  e.target.style.backgroundColor = '#4b5563';
                  e.target.style.boxShadow = '0 4px 6px rgba(0,0,0,0.15)';
                  e.target.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseOut={(e) => {
                e.target.style.backgroundColor = '#6b7280';
                e.target.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                e.target.style.transform = 'translateY(0)';
              }}
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmStamping}
              disabled={loading}
              style={{
                backgroundColor: '#dc2626',
                color: 'white',
                border: 'none',
                padding: '0.85rem 1.75rem',
                borderRadius: '6px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '1rem',
                fontWeight: '600',
                transition: 'all 0.2s',
                boxShadow: '0 4px 6px rgba(220, 38, 38, 0.3)',
                opacity: loading ? 0.7 : 1,
                transform: loading ? 'scale(0.98)' : 'scale(1)'
              }}
              onMouseOver={(e) => {
                if (!loading) {
                  e.target.style.backgroundColor = '#b91c1c';
                  e.target.style.boxShadow = '0 6px 12px rgba(220, 38, 38, 0.4)';
                  e.target.style.transform = 'translateY(-2px)';
                }
              }}
              onMouseOut={(e) => {
                e.target.style.backgroundColor = '#dc2626';
                e.target.style.boxShadow = '0 4px 6px rgba(220, 38, 38, 0.3)';
                e.target.style.transform = 'translateY(0)';
              }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <span style={{
                    display: 'inline-block',
                    width: '14px',
                    height: '14px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTop: '2px solid white',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite'
                  }} />
                  Timbrando...
                </span>
              ) : (
                '🔒 Confirmar Timbrado'
              )}
            </button>
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        </div>
      </div>
    );
  }

  // PROCESSING VIEW
  if (step === 'processing') {
    return (
      <div style={{ padding: '2rem' }}>
        <div style={{
          maxWidth: '600px',
          margin: '0 auto',
          textAlign: 'center',
          padding: '2rem',
          border: '1px solid var(--gray-200)',
          borderRadius: '8px',
          backgroundColor: 'var(--gray-50)'
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
          <h2>Procesando...</h2>
          {progress && (
            <p style={{ color: 'var(--primary-color)', marginTop: '1rem', fontSize: '1.05rem' }}>
              {progress}
            </p>
          )}
          <div style={{ marginTop: '2rem' }}>
            <div style={{
              display: 'inline-block',
              width: '40px',
              height: '40px',
              border: '4px solid var(--gray-300)',
              borderTop: '4px solid var(--primary-color)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
          </div>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  // SUCCESS VIEW
  if (step === 'success') {
    return (
      <div style={{ padding: '2rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <button
            onClick={() => {
              setStep('list');
              setSelectedSale(null);
              setResult(null);
            }}
            style={{
              backgroundColor: 'var(--gray-500)',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            ← Volver al listado
          </button>
        </div>

        <div className="card">
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>✓</div>
            <h2>¡Factura Timbrada Exitosamente!</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div style={{
              border: '1px solid var(--gray-200)',
              borderRadius: '4px',
              padding: '1rem',
              backgroundColor: 'var(--gray-50)'
            }}>
              <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Datos de la Venta</h3>
              <p><strong>ID Venta:</strong> {result.sale?.id}</p>
              <p><strong>Folio:</strong> {result.sale?.folio || 'N/A'}</p>
              <p><strong>Cliente:</strong> {result.sale?.customer?.nombre}</p>
              <p><strong>RFC:</strong> {result.sale?.customer?.rfc}</p>
              <p><strong>Total:</strong> ${result.sale?.total?.toFixed(2) || 'N/A'}</p>
            </div>

            <div style={{
              border: '1px solid var(--primary-color)',
              borderRadius: '4px',
              padding: '1rem',
              backgroundColor: 'var(--primary-color)',
              color: 'white'
            }}>
              <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Datos del CFDI Timbrado</h3>
              <p><strong>UUID:</strong> {result.uuid}</p>
              <p><strong>Estado:</strong> Timbrado</p>
              <p><strong>Total:</strong> ${result.invoice?.Total?.toFixed(2)}</p>
              <p><strong>Conceptos:</strong> {result.invoice?.Conceptos?.length}</p>
            </div>
          </div>

          {result.cfdi && (
            <div style={{ marginTop: '2rem' }}>
              <h3 style={{ marginBottom: '1rem' }}>XML del CFDI Timbrado</h3>
              <textarea
                readOnly
                value={result.cfdi}
                style={{
                  width: '100%',
                  height: '100px',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  padding: '1rem',
                  border: '1px solid var(--gray-300)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--gray-900)',
                  color: '#00ff00',
                  overflow: 'auto'
                }}
              />
            </div>
          )}

          <div style={{ marginTop: '2rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <button
              onClick={() => {
                setStep('list');
                setSelectedSale(null);
                setResult(null);
              }}
              style={{
                backgroundColor: 'var(--primary-color)',
                color: 'white',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '1rem'
              }}
            >
              Facturar otra venta
            </button>
            {result.pdf && (
              <a
                href={result.pdf}
                download={`CFDI-${result.uuid}.pdf`}
                style={{
                  backgroundColor: 'var(--success-color)',
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  textDecoration: 'none',
                  textAlign: 'center'
                }}
              >
                📄 Descargar PDF
              </a>
            )}
            <button
              onClick={() => window.print()}
              style={{
                backgroundColor: 'var(--gray-600)',
                color: 'white',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '1rem'
              }}
            >
              Imprimir
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ERROR VIEW
  return (
    <div style={{ padding: '2rem' }}>
      <div className="card">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem', color: 'var(--error-color)' }}>✗</div>
          <h2>Error en el Proceso</h2>
        </div>

        {error && (
          <div className="error-message" style={{ marginBottom: '1.5rem' }}>
            {error}
          </div>
        )}

        <button
          onClick={() => {
            setStep('list');
            setError(null);
            setSelectedSale(null);
            setResult(null);
          }}
          style={{
            backgroundColor: 'var(--primary-color)',
            color: 'white',
            border: 'none',
            padding: '0.75rem 1.5rem',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '1rem'
          }}
        >
          Intentar de nuevo
        </button>
      </div>
    </div>
  );
}
