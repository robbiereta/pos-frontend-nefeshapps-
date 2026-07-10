import { useState, useEffect } from 'react';
import { salesService, userService } from '../services/api';
import { productService } from '../services/productService';

const Pos = () => {
  const [cart, setCart] = useState([]);
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productsError, setProductsError] = useState(null);
  const [customer, setCustomer] = useState({
    rfc: 'XAXX010101000',
    nombre: 'PUBLICO EN GENERAL',
    usoCFDI: 'G03',
    domicilioFiscalReceptor: '87000',
    regimenFiscalReceptor: '616',
    email: ''
  });
  const [paymentMethod, setPaymentMethod] = useState('PUE');
  const [paymentForm, setPaymentForm] = useState('01');
  const [loading, setLoading] = useState(false);
  const [emisor, setEmisor] = useState(null);

  // Fetch products and emisor config on mount
  useEffect(() => {
    fetchProducts();
    fetchEmisorConfig();
  }, []);

  const fetchEmisorConfig = async () => {
    try {
      const config = await userService.getEmisorConfig();
      setEmisor(config?.data || null);
    } catch (err) {
      console.error('Error fetching emisor config:', err);
    }
  };

  const fetchProducts = async () => {
    try {
      setLoadingProducts(true);
      setProductsError(null);
      const response = await productService.getProducts({ limit: 100, activo: 'true' });
      const productsList = response.data?.products || response.data || [];

      // Map API products to POS format
      const posProducts = productsList.map(p => ({
        _id: p._id,
        id: p._id,
        nombre: p.nombre,
        descripcion: p.descripcion || p.nombre,
        valorUnitario: p.precioVenta || p.precioUnitario,
        claveProdServ: p.claveProdServ || '01010101',
        claveUnidad: p.claveUnidad || 'E48',
        unidad: p.unidad || 'Pieza',
        objetoImp: p.objetoImp || '02',
        categoria: p.categoria || 'Productos',
        sku: p.sku
      }));

      setProducts(posProducts);
    } catch (err) {
      console.error('Error fetching products:', err);
      setProductsError('Error al cargar productos. Usando catálogo por defecto.');
      // Fallback to default products
      setProducts([
        {
          _id: '1',
          id: 1,
          nombre: 'Hamburguesa Especial con Queso',
          descripcion: 'Hamburguesa Especial con Queso',
          valorUnitario: 350.00,
          claveProdServ: '50201501',
          claveUnidad: 'E48',
          unidad: 'Pieza',
          objetoImp: '02',
          categoria: 'Comida'
        },
        {
          _id: '2',
          id: 2,
          nombre: 'Refresco 600ml',
          descripcion: 'Refresco 600ml',
          valorUnitario: 30.00,
          claveProdServ: '50202304',
          claveUnidad: 'E48',
          unidad: 'Pieza',
          objetoImp: '02',
          categoria: 'Bebidas'
        },
        {
          _id: '3',
          id: 3,
          nombre: 'Papas Fritas Grandes',
          descripcion: 'Papas Fritas Grandes',
          valorUnitario: 70.00,
          claveProdServ: '50201501',
          claveUnidad: 'E48',
          unidad: 'Pieza',
          objetoImp: '02',
          categoria: 'Comida'
        }
      ]);
    } finally {
      setLoadingProducts(false);
    }
  };

  // Calculate totals for IVA-inclusive prices
  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + (item.importe), 0);
  };

  const calculateTax = () => {
    const total = calculateTotal();
    return total / 1.16 * 0.16; // Extract IVA from inclusive price
  };

  const calculateSubtotal = () => {
    const total = calculateTotal();
    const tax = calculateTax();
    return total - tax; // Base amount without IVA
  };

  // Add item to cart
  const addToCart = (product) => {
    const existingItem = cart.find(item => item.id === product.id);
    
    if (existingItem) {
      const newCantidad = existingItem.cantidad + 1;
      const newImporte = newCantidad * existingItem.valorUnitario; // IVA-inclusive total
      const baseAmount = newImporte / 1.16; // Base without IVA
      const ivaAmount = newImporte - baseAmount; // IVA amount
      
      setCart(cart.map(item => 
        item.id === product.id 
          ? { 
              ...item, 
              cantidad: newCantidad,
              importe: newImporte,
              impuestos: {
                traslados: [{
                  base: baseAmount,
                  impuesto: '002',
                  tipoFactor: 'Tasa',
                  tasaOCuota: '0.160000',
                  importe: ivaAmount
                }]
              }
            }
          : item
      ));
    } else {
      const baseAmount = product.valorUnitario / 1.16; // Base without IVA
      const ivaAmount = product.valorUnitario - baseAmount; // IVA amount
      
      const newItem = {
        ...product,
        cantidad: 1,
        importe: product.valorUnitario, // IVA-inclusive price
        descuento: 0,
        impuestos: {
          traslados: [{
            base: baseAmount,
            impuesto: '002',
            tipoFactor: 'Tasa',
            tasaOCuota: '0.160000',
            importe: ivaAmount
          }]
        }
      };
      setCart([...cart, newItem]);
    }
  };

  // Update item quantity
  const updateQuantity = (itemId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(itemId);
      return;
    }

    setCart(cart.map(item => {
      if (item.id === itemId) {
        const newImporte = newQuantity * item.valorUnitario; // IVA-inclusive total
        const baseAmount = newImporte / 1.16; // Base without IVA
        const ivaAmount = newImporte - baseAmount; // IVA amount
        
        return {
          ...item,
          cantidad: newQuantity,
          importe: newImporte,
          impuestos: {
            traslados: [{
              base: baseAmount,
              impuesto: '002',
              tipoFactor: 'Tasa',
              tasaOCuota: '0.160000',
              importe: ivaAmount
            }]
          }
        };
      }
      return item;
    }));
  };

  // Remove from cart
  const removeFromCart = (itemId) => {
    setCart(cart.filter(item => item.id !== itemId));
  };

  // Clear cart
  const clearCart = () => {
    setCart([]);
  };

  // Generate thermal receipt (58mm width)
  const generateThermalReceipt = (saleData, folio) => {
    const total = calculateTotal();
    const subtotal = calculateSubtotal();
    const tax = calculateTax();
    const now = new Date();
    const dateStr = now.toLocaleDateString('es-MX');
    const timeStr = now.toLocaleTimeString('es-MX');

    const receiptHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Recibo POS</title>
        <style>
          * { margin: 0; padding: 0; }
          body {
            font-family: 'Courier New', monospace;
            width: 58mm;
            font-size: 10pt;
            line-height: 1.2;
          }
          .receipt {
            width: 58mm;
            padding: 4mm;
            text-align: center;
          }
          .header {
            font-weight: bold;
            margin-bottom: 4mm;
            border-bottom: 1px dashed #000;
            padding-bottom: 2mm;
          }
          .title { font-size: 12pt; font-weight: bold; }
          .subtitle { font-size: 9pt; }
          .folio-section {
            margin: 4mm 0;
            padding: 2mm 0;
            border-bottom: 1px dashed #000;
            border-top: 1px dashed #000;
          }
          .folio { font-weight: bold; font-size: 11pt; }
          .date-time { font-size: 8pt; }
          .items {
            text-align: left;
            margin: 4mm 0;
            border-bottom: 1px dashed #000;
            padding-bottom: 2mm;
          }
          .item-line {
            display: flex;
            justify-content: space-between;
            font-size: 9pt;
            margin-bottom: 1mm;
          }
          .item-desc { flex: 1; }
          .item-qty { width: 25px; text-align: center; }
          .item-price { width: 35px; text-align: right; }
          .totals {
            text-align: right;
            margin: 4mm 0;
            border-bottom: 1px solid #000;
            padding-bottom: 2mm;
          }
          .total-line {
            display: flex;
            justify-content: space-between;
            font-size: 9pt;
            margin-bottom: 2mm;
          }
          .total-amount {
            font-weight: bold;
            font-size: 12pt;
            margin: 2mm 0;
          }
          .footer {
            margin-top: 4mm;
            font-size: 8pt;
            text-align: center;
          }
          .divider {
            border-top: 1px dashed #000;
            margin: 2mm 0;
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="header">
            <div class="title">${emisor?.nombre || 'PUNTO DE VENTA'}</div>
            <div class="subtitle">RFC: ${emisor?.rfc || 'N/A'}</div>
            ${emisor?.direccion ? `<div class="subtitle">${emisor.direccion}</div>` : ''}
          </div>

          <div class="folio-section">
            <div class="folio">Folio: ${folio}</div>
            <div class="date-time">${dateStr} ${timeStr}</div>
          </div>

          <div class="items">
            ${cart.map((item, idx) => `
              <div class="item-line">
                <div class="item-desc">${item.descripcion}</div>
              </div>
              <div class="item-line">
                <div class="item-qty">${item.cantidad}x</div>
                <div class="item-price">$${(item.valorUnitario).toFixed(2)}</div>
                <div class="item-price">=</div>
                <div class="item-price">$${item.importe.toFixed(2)}</div>
              </div>
            `).join('')}
          </div>

          <div class="totals">
            <div class="total-line">
              <span>Subtotal:</span>
              <span>$${subtotal.toFixed(2)}</span>
            </div>
            <div class="total-line">
              <span>IVA (16%):</span>
              <span>$${tax.toFixed(2)}</span>
            </div>
            <div class="divider"></div>
            <div class="total-amount">
              <div class="total-line">
                <span>TOTAL:</span>
                <span>$${total.toFixed(2)}</span>
              </div>
            </div>
            <div class="total-line">
              <span>Pago:</span>
              <span>${paymentMethod === 'PUE' ? 'Pago único' : 'Pago diferido'}</span>
            </div>
          </div>

          <div class="footer">
            <div>${emisor?.receiptMessage || '¡Gracias por su compra!'}</div>
            ${emisor?.telefonoFacturacion ? `<div style="margin-top: 2mm;">${emisor.telefonoFacturacion}</div>` : ''}
          </div>
        </div>
      </body>
      </html>
    `;

    return receiptHTML;
  };

  // Print receipt on thermal printer (direct, no new tab)
  const printThermalReceipt = (receiptHTML) => {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    iframe.onload = () => {
      iframe.contentWindow.document.write(receiptHTML);
      iframe.contentWindow.document.close();

      setTimeout(() => {
        iframe.contentWindow.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 100);
      }, 250);
    };

    iframe.src = 'about:blank';
  };

  // Process sale
  const processSale = async () => {
    if (cart.length === 0) {
      alert('El carrito está vacío');
      return;
    }

    setLoading(true);

    try {
      const total = calculateTotal();
      const totalImpuestosTrasladados = calculateTax();
      const subtotal = calculateSubtotal();

      // Generate unique folio
      const timestamp = Date.now();
      const folio = `POS-${timestamp}`;

      const saleData = {
        folio,
        saleId: `SALE-${timestamp}`,
        externalReference: `POS-ORDER-${timestamp}`,
        saleDate: new Date(),
        customer,
        subtotal,
        descuento: 0,
        total,
        totalImpuestosTrasladados,
        totalImpuestosRetenidos: 0,
        metodoPago: paymentMethod,
        formaPago: paymentForm,
        moneda: 'MXN',
        tipoCambio: 1,
        items: cart.map(item => ({
          claveProdServ: item.claveProdServ,
          cantidad: item.cantidad,
          claveUnidad: item.claveUnidad,
          unidad: item.unidad,
          descripcion: item.descripcion,
          valorUnitario: item.valorUnitario,
          importe: item.importe,
          descuento: 0,
          objetoImp: item.objetoImp,
          impuestos: item.impuestos
        })),
        impuestos: {
          traslados: [{
            base: subtotal,
            impuesto: '002',
            tipoFactor: 'Tasa',
            tasaOCuota: '0.160000',
            importe: totalImpuestosTrasladados
          }],
          retenciones: []
        },
        status: 'pagado',
        salesType: 'pos',
        origin: 'admin',
        notes: 'Venta generada desde POS',
        source: 'pos-frontend'
      };

      const response = await salesService.createSale(saleData);

      // Generate and print thermal receipt
      const receiptHTML = generateThermalReceipt(saleData, folio);
      printThermalReceipt(receiptHTML);

      alert(`Venta procesada exitosamente!\nFolio: ${folio}\nTotal: $${total.toFixed(2)}`);
      clearCart();

    } catch (error) {
      console.error('Error processing sale:', error);
      alert('Error al procesar la venta: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Punto de Venta (POS)</h1>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '20px' }}>
        {/* Products Section */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h2>Catálogo de Productos</h2>
            <button
              onClick={fetchProducts}
              style={{
                padding: '8px 16px',
                backgroundColor: '#2c5aa0',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              🔄 Actualizar
            </button>
          </div>

          {productsError && (
            <div style={{ backgroundColor: '#fff3cd', color: '#856404', padding: '10px', borderRadius: '4px', marginBottom: '10px' }}>
              ⚠️ {productsError}
            </div>
          )}

          {loadingProducts ? (
            <p>Cargando productos...</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
              {products.map(product => (
                <div key={product._id || product.id} style={{
                  border: '1px solid #ddd',
                  padding: '15px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  backgroundColor: '#f9f9f9',
                  transition: 'all 0.2s',
                  ':hover': { boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }
                }} onClick={() => addToCart(product)}>
                  <h4 style={{ margin: '0 0 5px 0' }}>{product.nombre || product.descripcion}</h4>
                  <p style={{ color: '#666', fontSize: '0.85em', margin: '3px 0' }}>
                    📦 {product.categoria}
                    {product.sku && <> | SKU: {product.sku}</>}
                  </p>
                  <p style={{ fontSize: '1.2em', fontWeight: 'bold', color: '#2c5aa0', margin: '8px 0 0 0' }}>
                    ${product.valorUnitario.toFixed(2)} <span style={{ fontSize: '0.8em', color: '#666' }}>(IVA incl.)</span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cart Section - Modern Design */}
        <div style={{
          fontFamily: 'system-ui, -apple-system, sans-serif',
          borderRadius: '12px',
          backgroundColor: '#fff',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.08)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          height: '100%'
        }}>
          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            padding: '20px',
            textAlign: 'center'
          }}>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>🛒 Carrito</h2>
          </div>

          {cart.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: '14px' }}>
              El carrito está vacío
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              {/* Items Scroll */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '15px',
                borderBottom: '1px solid #f0f0f0'
              }}>
                {cart.map(item => (
                  <div key={item.id} style={{
                    backgroundColor: '#f8f9fa',
                    padding: '12px',
                    marginBottom: '10px',
                    borderRadius: '8px',
                    border: '1px solid #e9ecef'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: '600', color: '#333' }}>
                          {item.descripcion}
                        </h4>
                        <p style={{ margin: 0, fontSize: '12px', color: '#999' }}>
                          ${item.valorUnitario.toFixed(2)} c/u
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#667eea' }}>
                          ${item.importe.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => updateQuantity(item.id, item.cantidad - 1)}
                        style={{
                          flex: 1,
                          padding: '6px',
                          fontSize: '12px',
                          backgroundColor: '#e9ecef',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: '600',
                          transition: 'all 0.2s',
                          color: '#495057'
                        }}
                        onMouseOver={(e) => e.target.style.backgroundColor = '#dee2e6'}
                        onMouseOut={(e) => e.target.style.backgroundColor = '#e9ecef'}
                      >−</button>
                      <div style={{
                        flex: 1,
                        textAlign: 'center',
                        padding: '6px',
                        backgroundColor: '#f8f9fa',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '600',
                        border: '1px solid #dee2e6'
                      }}>
                        {item.cantidad}
                      </div>
                      <button
                        onClick={() => updateQuantity(item.id, item.cantidad + 1)}
                        style={{
                          flex: 1,
                          padding: '6px',
                          fontSize: '12px',
                          backgroundColor: '#e9ecef',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: '600',
                          transition: 'all 0.2s',
                          color: '#495057'
                        }}
                        onMouseOver={(e) => e.target.style.backgroundColor = '#dee2e6'}
                        onMouseOut={(e) => e.target.style.backgroundColor = '#e9ecef'}
                      >+</button>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        style={{
                          flex: 1,
                          padding: '6px',
                          fontSize: '12px',
                          backgroundColor: '#ffe0e0',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: '600',
                          color: '#dc3545',
                          transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => e.target.style.backgroundColor = '#ffcccc'}
                        onMouseOut={(e) => e.target.style.backgroundColor = '#ffe0e0'}
                      >✕</button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div style={{ padding: '15px', backgroundColor: '#f8f9fa', borderBottom: '1px solid #e9ecef' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '13px' }}>
                  <span style={{ color: '#666' }}>Subtotal:</span>
                  <span style={{ fontWeight: '600', color: '#333' }}>${calculateSubtotal().toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '13px', borderBottom: '1px solid #e9ecef', paddingBottom: '12px' }}>
                  <span style={{ color: '#666' }}>IVA (16%):</span>
                  <span style={{ fontWeight: '600', color: '#333' }}>${calculateTax().toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: '700' }}>
                  <span>Total:</span>
                  <span style={{ color: '#667eea' }}>${calculateTotal().toFixed(2)}</span>
                </div>
              </div>

              {/* Payment Info */}
              <div style={{ padding: '15px' }}>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#495057', marginBottom: '6px', display: 'block' }}>
                    Método de pago
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      marginBottom: '8px',
                      fontSize: '13px',
                      borderRadius: '6px',
                      border: '1px solid #dee2e6',
                      backgroundColor: '#fff',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="PUE">PUE - Pago único</option>
                    <option value="PPD">PPD - Pago diferido</option>
                  </select>
                  <select
                    value={paymentForm}
                    onChange={(e) => setPaymentForm(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '13px',
                      borderRadius: '6px',
                      border: '1px solid #dee2e6',
                      backgroundColor: '#fff',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="01">01 - Efectivo</option>
                    <option value="04">04 - Tarjeta crédito</option>
                    <option value="28">28 - Tarjeta débito</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#495057', marginBottom: '6px', display: 'block' }}>
                    Cliente
                  </label>
                  <input
                    type="text"
                    placeholder="RFC"
                    value={customer.rfc}
                    onChange={(e) => setCustomer({...customer, rfc: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      marginBottom: '8px',
                      fontSize: '12px',
                      borderRadius: '6px',
                      border: '1px solid #dee2e6',
                      boxSizing: 'border-box'
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Nombre"
                    value={customer.nombre}
                    onChange={(e) => setCustomer({...customer, nombre: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      marginBottom: '8px',
                      fontSize: '12px',
                      borderRadius: '6px',
                      border: '1px solid #dee2e6',
                      boxSizing: 'border-box'
                    }}
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={customer.email}
                    onChange={(e) => setCustomer({...customer, email: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '12px',
                      borderRadius: '6px',
                      border: '1px solid #dee2e6',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ padding: '15px', display: 'flex', gap: '10px' }}>
                <button
                  onClick={processSale}
                  disabled={loading || cart.length === 0}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: loading || cart.length === 0 ? '#ccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '700',
                    cursor: loading || cart.length === 0 ? 'not-allowed' : 'pointer',
                    transition: 'all 0.3s',
                    boxShadow: loading || cart.length === 0 ? 'none' : '0 4px 15px rgba(102, 126, 234, 0.3)'
                  }}
                  onMouseOver={(e) => !loading && cart.length > 0 && (e.target.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.4)')}
                  onMouseOut={(e) => !loading && cart.length > 0 && (e.target.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.3)')}
                >
                  {loading ? '⏳ Procesando...' : '✓ Vender'}
                </button>
                <button
                  onClick={clearCart}
                  disabled={cart.length === 0}
                  style={{
                    flex: 1,
                    padding: '12px',
                    backgroundColor: cart.length === 0 ? '#ccc' : '#f8f9fa',
                    color: cart.length === 0 ? '#999' : '#dc3545',
                    border: '2px solid ' + (cart.length === 0 ? '#ddd' : '#dc3545'),
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '700',
                    cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
                    transition: 'all 0.3s'
                  }}
                  onMouseOver={(e) => cart.length > 0 && (e.target.style.backgroundColor = '#dc3545', e.target.style.color = 'white')}
                  onMouseOut={(e) => cart.length > 0 && (e.target.style.backgroundColor = '#f8f9fa', e.target.style.color = '#dc3545')}
                >
                  ✕ Limpiar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default Pos;
