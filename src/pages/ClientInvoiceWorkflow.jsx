import { useState } from 'react';
import { salesService, invoiceService, userService } from '../services/api';

export default function ClientInvoiceWorkflow() {
  const [step, setStep] = useState('form'); // form, processing, confirm, success, error
  const [formData, setFormData] = useState({
    saleDate: new Date().toISOString().split('T')[0],
    customerRfc: 'RUS910704ID8',
    customerNombre: 'RUSAL',
    regimenFiscalReceptor: '601',
    domicilioFiscalReceptor: '87099',
    usoCFDI: 'G03',
    formaPago: '99',
    metodoPago: 'PPD',
  });

  const [items, setItems] = useState([
    {
      claveProdServ: '25174700',
      cantidad: 1,
      claveUnidad: 'H87',
      unidad: 'PIEZA',
      descripcion: 'PEDAL LATERAL',
      valorUnitario: 150.00,
    }
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [progress, setProgress] = useState('');

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      [field]: value
    };
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, {
      claveProdServ: '81111501',
      cantidad: 1,
      claveUnidad: 'E48',
      unidad: 'SERVICIO',
      descripcion: '',
      valorUnitario: 0,
    }]);
  };

  const removeItem = (index) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const calculateTotals = () => {
    return items.reduce((acc, item) => {
      const pu = parseFloat(item.valorUnitario) || 0;
      const cantidad = parseFloat(item.cantidad) || 0;
      const subtotal = pu * cantidad;
      acc.subtotal += subtotal;
      acc.iva += subtotal * 0.16;
      acc.total += subtotal * 1.16;
      return acc;
    }, { subtotal: 0, iva: 0, total: 0 });
  };

  const validateForm = () => {
    if (!formData.customerRfc.trim()) {
      setError('El RFC del cliente es requerido');
      return false;
    }
    if (!formData.customerNombre.trim()) {
      setError('El nombre del cliente es requerido');
      return false;
    }
    if (!formData.domicilioFiscalReceptor.trim()) {
      setError('El domicilio fiscal es requerido');
      return false;
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.valorUnitario || parseFloat(item.valorUnitario) <= 0) {
        setError(`El precio unitario del item ${i + 1} debe ser mayor a 0`);
        return false;
      }
      if (!item.cantidad || parseFloat(item.cantidad) <= 0) {
        setError(`La cantidad del item ${i + 1} debe ser mayor a 0`);
        return false;
      }
      if (!item.descripcion.trim()) {
        setError(`La descripción del item ${i + 1} es requerida`);
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setStep('processing');

    try {
      // Step 1: Create sale
      setProgress('Creando venta...');
      const salePayload = {
        saleDate: new Date(formData.saleDate).toISOString(),
        customer: {
          rfc: formData.customerRfc,
          nombre: formData.customerNombre,
          regimenFiscalReceptor: formData.regimenFiscalReceptor,
          domicilioFiscalReceptor: formData.domicilioFiscalReceptor,
          usoCFDI: formData.usoCFDI,
        },
        items: items.map(item => ({
          claveProdServ: item.claveProdServ,
          cantidad: item.cantidad,
          claveUnidad: item.claveUnidad,
          unidad: item.unidad,
          descripcion: item.descripcion,
          valorUnitario: parseFloat(item.valorUnitario),
          importe: parseFloat(item.valorUnitario) * parseFloat(item.cantidad),
        })),
        formaPago: formData.formaPago,
        metodoPago: formData.metodoPago,
        status: 'pendiente de facturar'
      };

      const saleResponse = await salesService.createSale(salePayload);
      const saleId = saleResponse.data?.id;

      if (!saleId) {
        throw new Error('La venta no se creó correctamente');
      }

      setProgress(`Venta creada: ${saleId}. Obteniendo detalles...`);

      // Step 2: Fetch the sale
      const saleData = await salesService.getSaleById(saleId);
      const sale = saleData.data;

      if (!sale) {
        throw new Error('No se pudo obtener la venta creada');
      }

      setProgress('Venta obtenida. Construyendo factura...');

      // Step 3: Build invoice from sale
      const invoicePayload = {
        notasPartidas: sale.items.map(item => ({
          pu: item.valorUnitario,
          cantidad: item.cantidad,
          Descripcion: item.descripcion,
          CodigoSat: item.claveProdServ,
          ClaveUnidad: item.claveUnidad,
          Unidad: item.unidad
        })),
        receptorRfc: sale.customer.rfc,
        receptorNombre: sale.customer.nombre,
        receptorRegimen: sale.customer.regimenFiscalReceptor,
        DomicilioFiscalReceptor: sale.customer.domicilioFiscalReceptor,
        UsoCFDI: sale.customer.usoCFDI,
        folio: sale.folio || '',
        formaPago: sale.formaPago,
        MetodoPago: sale.metodoPago
      };

      const invoiceData = await invoiceService.generateClient(invoicePayload);

      if (!invoiceData.data) {
        throw new Error('La factura no se generó correctamente');
      }

      setProgress('Generando PDF de la factura...');

      // Step 4: Generate PDF (before stamping for preview)
      let pdfResponse = null;
      try {
        pdfResponse = await invoiceService.generatePDF(JSON.stringify(invoiceData.data));
      } catch (pdfErr) {
        // Silently fail PDF generation
      }

      setProgress('');
      setResult({
        sale,
        invoice: invoiceData.data,
        pdf: pdfResponse?.data,
        stamped: null,
        uuid: null,
        cfdi: null,
      });

      setStep('confirm');
    } catch (err) {
      setError(err.message || 'Error en el proceso de facturación');
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

      // Step 1: Get emisor config for SW token
      const emisorConfig = await userService.getEmisorConfig();
      const swToken = emisorConfig.data?.emisorConfig?.sw_config?.tokenProd;
      const swEmail = emisorConfig.data?.emisorConfig?.sw_config?.email ||
                      emisorConfig.data?.emisorConfig?.emailFacturacion;

      if (!swToken) {
        throw new Error('No se encontró token SW.com.mx en la configuración. Verifica la configuración de emisor.');
      }

      setProgress('Timbrando factura con SW.com.mx...');

      // Step 2: Stamp invoice
      const stampPayload = {
        invoiceData: result.invoice,
        token: swToken,
        email: swEmail
      };

      const stampedResponse = await invoiceService.stampInvoice(stampPayload);

      setProgress('Generando PDF del CFDI timbrado...');

      // Step 3: Generate PDF of stamped invoice
      const cfdiXml = stampedResponse.data?.data?.cfdi;
      let stampedPdfResponse = null;

      if (cfdiXml) {
        try {
          stampedPdfResponse = await invoiceService.generatePDF(cfdiXml);
        } catch (pdfErr) {
          // Silently fail PDF generation
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
    } catch (err) {
      setError(err.message || 'Error al timbrar la factura');
      setStep('error');
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  const totals = calculateTotals();

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
          <h2>Procesando venta y factura...</h2>
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

  if (step === 'confirm') {
    return (
      <div style={{ padding: '2rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <button
            onClick={() => {
              setStep('form');
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
            ← Volver al formulario
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
            {/* Invoice Summary */}
            <div style={{
              border: '1px solid var(--gray-200)',
              borderRadius: '4px',
              padding: '1rem',
              backgroundColor: 'var(--gray-50)'
            }}>
              <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Resumen de Factura</h3>
              <p><strong>Cliente:</strong> {result.invoice?.Receptor?.Nombre}</p>
              <p><strong>RFC:</strong> {result.invoice?.Receptor?.Rfc}</p>
              <p><strong>Total:</strong> ${result.invoice?.Total?.toFixed(2)}</p>
              <p><strong>Conceptos:</strong> {result.invoice?.Conceptos?.length || 0}</p>
              <p><strong>Forma de Pago:</strong> {result.invoice?.FormaPago}</p>
              <p><strong>Método de Pago:</strong> {result.invoice?.MetodoPago}</p>
            </div>

            {/* PDF Preview */}
            <div style={{
              border: '1px solid var(--gray-200)',
              borderRadius: '4px',
              padding: '1rem',
              backgroundColor: 'var(--gray-50)',
              textAlign: 'center'
            }}>
              <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Vista Previa</h3>
              {result.pdf ? (
                <div>
                  <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📄</div>
                  <p style={{ color: 'var(--gray-600)', marginBottom: '1rem' }}>PDF generado correctamente</p>
                  <a
                    href={result.pdf}
                    download={`CFDI-preview-${Date.now()}.pdf`}
                    style={{
                      backgroundColor: 'var(--primary-color)',
                      color: 'white',
                      padding: '0.5rem 1rem',
                      borderRadius: '4px',
                      textDecoration: 'none',
                      display: 'inline-block'
                    }}
                  >
                    Descargar vista previa
                  </a>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '3rem', marginBottom: '0.5rem', opacity: 0.5 }}>📄</div>
                  <p style={{ color: 'var(--gray-500)' }}>No se pudo generar PDF de vista previa</p>
                </div>
              )}
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
                      <td style={{ padding: '0.5rem', textAlign: 'right' }}>${item.ValorUnitario?.toFixed(2)}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 'bold' }}>
                        ${item.Importe?.toFixed(2)}
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
                setStep('form');
                setResult(null);
              }}
              disabled={loading}
              style={{
                backgroundColor: 'var(--gray-500)',
                color: 'white',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '1rem',
                opacity: loading ? 0.6 : 1
              }}
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmStamping}
              disabled={loading}
              style={{
                backgroundColor: 'var(--error-color)',
                color: 'white',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '1rem',
                opacity: loading ? 0.6 : 1
              }}
            >
              {loading ? 'Timbrado en progreso...' : '🔒 Confirmar Timbrado'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div style={{ padding: '2rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <button
            onClick={() => {
              setStep('form');
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
            ← Volver al formulario
          </button>
        </div>

        <div className="card">
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>✓</div>
            <h2>¡Factura Timbrada Exitosamente!</h2>
          </div>

          {error && <div className="error-message">{error}</div>}

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
              <p><strong>Items:</strong> {result.sale?.items?.length || 0}</p>
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
              <p><strong>Total Facturado:</strong> ${result.invoice?.Total?.toFixed(2) || 'N/A'}</p>
              <p><strong>Concepto:</strong> {result.invoice?.Conceptos?.length || 0} items</p>
              <p><strong>Receptor:</strong> {result.invoice?.Receptor?.Nombre}</p>
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
                  height: '120px',
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
                setStep('form');
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
              Crear otra factura
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

  if (step === 'error') {
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
              setStep('form');
              setError(null);
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

  return (
    <>
      <h2 style={{ marginBottom: '1.5rem' }}>Crear Venta y Generar Factura</h2>

      <div className="card">
        <h3 style={{ marginBottom: '0.5rem' }}>Flujo Completo: Venta → PDF de Factura → Timbrado</h3>
        <p style={{ color: 'var(--gray-500)', marginBottom: '1.5rem' }}>
          Crea una venta completa, genera un PDF de vista previa y confirma antes de timbrar con SW.com.mx.
        </p>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          {/* Cliente */}
          <div style={{ marginBottom: '2rem' }}>
            <h4 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--primary-color)' }}>
              Datos del Cliente
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem', marginBottom: '1rem' }}>
              <div className="form-group">
                <label htmlFor="customerRfc">RFC del Cliente *</label>
                <input
                  type="text"
                  id="customerRfc"
                  name="customerRfc"
                  value={formData.customerRfc}
                  onChange={handleInputChange}
                  placeholder="RFC12345ABC"
                  required
                  style={{ textTransform: 'uppercase' }}
                />
              </div>
              <div className="form-group">
                <label htmlFor="customerNombre">Nombre del Cliente *</label>
                <input
                  type="text"
                  id="customerNombre"
                  name="customerNombre"
                  value={formData.customerNombre}
                  onChange={handleInputChange}
                  placeholder="Nombre completo del cliente"
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label htmlFor="regimenFiscalReceptor">Régimen Fiscal</label>
                <select
                  id="regimenFiscalReceptor"
                  name="regimenFiscalReceptor"
                  value={formData.regimenFiscalReceptor}
                  onChange={handleInputChange}
                >
                  <option value="601">601 - General de Ley</option>
                  <option value="616">616 - Sin obligaciones fiscales</option>
                  <option value="607">607 - Régimen empresarial</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="domicilioFiscalReceptor">Código Postal *</label>
                <input
                  type="text"
                  id="domicilioFiscalReceptor"
                  name="domicilioFiscalReceptor"
                  value={formData.domicilioFiscalReceptor}
                  onChange={handleInputChange}
                  placeholder="87099"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="usoCFDI">Uso del CFDI</label>
                <select
                  id="usoCFDI"
                  name="usoCFDI"
                  value={formData.usoCFDI}
                  onChange={handleInputChange}
                >
                  <option value="G01">G01 - Adquisición de mercancías</option>
                  <option value="G03">G03 - Gastos en general</option>
                  <option value="I01">I01 - Construcciones</option>
                  <option value="D01">D01 - Honorarios médicos</option>
                  <option value="P01">P01 - Por definir</option>
                </select>
              </div>
            </div>
          </div>

          {/* Items */}
          <div style={{ marginBottom: '2rem' }}>
            <h4 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--primary-color)' }}>
              Conceptos (Items)
            </h4>

            {items.map((item, index) => (
              <div key={index} style={{
                border: '1px solid var(--gray-200)',
                borderRadius: '4px',
                padding: '1rem',
                marginBottom: '1rem',
                backgroundColor: 'var(--gray-50)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h5 style={{ margin: 0, fontSize: '0.9rem' }}>Item {index + 1}</h5>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      style={{
                        backgroundColor: 'var(--error-color)',
                        color: 'white',
                        border: 'none',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.8rem'
                      }}
                    >
                      Eliminar
                    </button>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <div className="form-group">
                    <label>Descripción *</label>
                    <input
                      type="text"
                      value={item.descripcion}
                      onChange={(e) => handleItemChange(index, 'descripcion', e.target.value)}
                      placeholder="Descripción del producto"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Precio Unitario *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={item.valorUnitario}
                      onChange={(e) => handleItemChange(index, 'valorUnitario', e.target.value)}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Cantidad *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={item.cantidad}
                      onChange={(e) => handleItemChange(index, 'cantidad', e.target.value)}
                      placeholder="1"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Total</label>
                    <input
                      type="text"
                      value={(parseFloat(item.valorUnitario) || 0) * (parseFloat(item.cantidad) || 0)}
                      readOnly
                      style={{ backgroundColor: 'var(--gray-100)' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                  <div className="form-group">
                    <label>Clave SAT</label>
                    <select
                      value={item.claveProdServ}
                      onChange={(e) => handleItemChange(index, 'claveProdServ', e.target.value)}
                    >
                      <option value="25174700">25174700 - Piezas para bicicleta</option>
                      <option value="81111501">81111501 - Consultoría</option>
                      <option value="78181500">78181500 - Mano de obra</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Clave Unidad</label>
                    <select
                      value={item.claveUnidad}
                      onChange={(e) => handleItemChange(index, 'claveUnidad', e.target.value)}
                    >
                      <option value="H87">H87 - Pieza</option>
                      <option value="E48">E48 - Servicio</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Unidad</label>
                    <input
                      type="text"
                      value={item.unidad}
                      onChange={(e) => handleItemChange(index, 'unidad', e.target.value)}
                      placeholder="PIEZA"
                    />
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addItem}
              style={{
                backgroundColor: 'var(--primary-color)',
                color: 'white',
                border: 'none',
                padding: '0.5rem 1rem',
                borderRadius: '4px',
                cursor: 'pointer',
                marginBottom: '1rem'
              }}
            >
              + Agregar Item
            </button>
          </div>

          {/* Pago */}
          <div style={{ marginBottom: '2rem' }}>
            <h4 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--primary-color)' }}>
              Forma de Pago
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label htmlFor="formaPago">Forma de Pago</label>
                <select
                  id="formaPago"
                  name="formaPago"
                  value={formData.formaPago}
                  onChange={handleInputChange}
                >
                  <option value="01">01 - Efectivo</option>
                  <option value="03">03 - Transferencia electrónica</option>
                  <option value="04">04 - Tarjeta de crédito</option>
                  <option value="05">05 - Tarjeta de débito</option>
                  <option value="99">99 - Por definir</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="metodoPago">Método de Pago</label>
                <select
                  id="metodoPago"
                  name="metodoPago"
                  value={formData.metodoPago}
                  onChange={handleInputChange}
                >
                  <option value="PUE">PUE - Pago en una sola exhibición</option>
                  <option value="PPD">PPD - Pago en parcialidades</option>
                </select>
              </div>
            </div>
          </div>

          {/* Resumen */}
          <div style={{
            border: '1px solid var(--gray-200)',
            borderRadius: '4px',
            padding: '1rem',
            marginBottom: '2rem',
            backgroundColor: 'var(--gray-50)'
          }}>
            <h4 style={{ marginBottom: '1rem' }}>Resumen de Totales</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <div>
                <span style={{ color: 'var(--gray-600)' }}>Subtotal:</span>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                  ${totals.subtotal.toFixed(2)}
                </div>
              </div>
              <div>
                <span style={{ color: 'var(--gray-600)' }}>IVA (16%):</span>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                  ${totals.iva.toFixed(2)}
                </div>
              </div>
              <div>
                <span style={{ color: 'var(--gray-600)' }}>Total:</span>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>
                  ${totals.total.toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', padding: '0.75rem' }}
          >
            {loading ? 'Procesando...' : 'Crear Venta y Generar PDF'}
          </button>
        </form>
      </div>
    </>
  );
}
