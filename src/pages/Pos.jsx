import { useState, useEffect } from 'react';
import { salesService, userService, clientService } from '../services/api';
import { productService } from '../services/productService';
import { notesService } from '../services/notesService';
import BarcodeSearch from '../components/BarcodeSearch';
import Button from '../components/ui/Button';
import { useToast } from '../components/ui/Toast.jsx';

const Pos = () => {
  const [cart, setCart] = useState([]);
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productsError, setProductsError] = useState(null);
  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [selectedClientId, setSelectedClientId] = useState('default');
  const [clientSearch, setClientSearch] = useState('');
  const [editingPriceId, setEditingPriceId] = useState(null);
  const [editingPriceValue, setEditingPriceValue] = useState('');
  const [customer, setCustomer] = useState({
    rfc: 'XAXX010101000',
    nombre: 'PUBLICO EN GENERAL',
    usoCFDI: 'G03',
    domicilioFiscalReceptor: '',
    regimenFiscalReceptor: '',
    email: ''
  });
  const [paymentMethod, setPaymentMethod] = useState('PUE');
  const [paymentForm, setPaymentForm] = useState('01');
  const [loading, setLoading] = useState(false);
  const [emisor, setEmisor] = useState(null);
  const toast = useToast();

  // Fetch products, clients, and emisor config on mount
  useEffect(() => {
    fetchProducts();
    fetchClients();
    fetchEmisorConfig();
  }, []);

  const fetchClients = async () => {
    try {
      setLoadingClients(true);
      const response = await clientService.getAllClients({ limit: 100 });
      setClients(response.data?.clients || response.data || []);
    } catch (err) {
      setClients([]);
    } finally {
      setLoadingClients(false);
    }
  };

  const fetchEmisorConfig = async () => {
    try {
      const config = await userService.getEmisorConfig();
      setEmisor(config?.data || null);
    } catch (err) {
      // Silent error
    }
  };

  const handleClientChange = (clientId) => {
    setSelectedClientId(clientId);
    setClientSearch('');
    if (clientId === 'default') {
      setCustomer({
        rfc: 'XAXX010101000',
        nombre: 'PUBLICO EN GENERAL',
      });
    } else {
      const selectedClient = clients.find(c => c._id === clientId);
      if (selectedClient) {
        setCustomer({
          rfc: selectedClient.rfc,
          nombre: selectedClient.nombre,
          usoCFDI: selectedClient.usoCFDI || 'G03',
          domicilioFiscalReceptor: selectedClient.domicilioFiscalReceptor || '87000',
          regimenFiscalReceptor: selectedClient.regimenFiscalReceptor || '616',
          email: selectedClient.email || ''
        });
      }
    }
  };

  const filteredClients = clients.filter(client =>
    client.nombre.toLowerCase().includes(clientSearch.toLowerCase()) ||
    client.rfc.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const handleUpdateItemPrice = (itemId, newPrice) => {
    const price = parseFloat(newPrice);
    if (isNaN(price) || price <= 0) return;

    setCart(cart.map(item => {
      if (item.id === itemId) {
        const newImporte = item.cantidad * price;
        const baseAmount = newImporte / 1.16;
        const ivaAmount = newImporte - baseAmount;

        return {
          ...item,
          valorUnitario: price,
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

    setEditingPriceId(null);
    setEditingPriceValue('');
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
      setProductsError('Error al cargar productos. Usando catálogo por defecto.');
      toast.warning('No se pudo cargar el catálogo. Usando productos por defecto.');
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
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      toast.success(`+1 ${product.nombre || product.descripcion}`);
    } else {
      toast.success(`Agregado: ${product.nombre || product.descripcion}`);
    }

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

  // Generate thermal receipt
  const generateThermalReceipt = (saleData, folio) => {
    const total = calculateTotal();
    const subtotal = calculateSubtotal();
    const tax = calculateTax();
    const now = new Date();
    const dateStr = now.toLocaleDateString('es-MX');
    const timeStr = now.toLocaleTimeString('es-MX');

    const receiptWidth = emisor?.receiptWidth || '58mm';
    const fontSize = receiptWidth === '80mm' ? '11pt' : '10pt';
    const padding = receiptWidth === '80mm' ? '5mm' : '4mm';

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
            width: ${receiptWidth};
            font-size: ${fontSize};
            line-height: 1.2;
          }
          .receipt {
            width: ${receiptWidth};
            padding: ${padding};
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
          .customer-section {
            text-align: left;
            margin: 3mm 0;
            padding: 2mm;
            background-color: #f5f5f5;
            border: 1px dashed #000;
            font-size: 8pt;
          }
          .section-title {
            font-weight: bold;
            font-size: 8pt;
            margin-bottom: 1mm;
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
            ${emisor?.nombreComercial ? `<div class="title" style="font-size: 14pt;">${emisor.nombreComercial}</div>` : ''}
            <div class="title">${emisor?.nombre || 'PUNTO DE VENTA'}</div>
            <div class="subtitle">RFC: ${emisor?.rfc || 'N/A'}</div>
            ${emisor?.regimenFiscal ? `<div class="subtitle" style="font-size: 7pt;">Régimen: ${emisor.regimenFiscal}</div>` : ''}
            ${emisor?.calle ? `<div class="subtitle">${emisor.calle} ${emisor?.numeroExterior || ''}</div>` : ''}
            ${emisor?.colonia ? `<div class="subtitle">${emisor.colonia}</div>` : ''}
            ${emisor?.ciudad || emisor?.estado ? `<div class="subtitle">${emisor?.ciudad || ''} ${emisor?.estado || ''}</div>` : ''}
            ${emisor?.codigoPostal ? `<div class="subtitle">CP: ${emisor.codigoPostal}</div>` : ''}
          </div>

          <div class="folio-section">
            <div class="folio">Folio: ${folio}</div>
            <div class="date-time">${dateStr} ${timeStr}</div>
          </div>

          <div class="customer-section">
            <div class="section-title">CLIENTE:</div>
            <div>${customer.nombre}</div>
            <div>RFC: ${customer.rfc}</div>
            ${customer.email ? `<div>Email: ${customer.email}</div>` : ''}
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

      // Generate unique folio with random suffix to avoid collisions
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      const folio = `POS${timestamp}${random}`;

      const saleData = {
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
      const saleFolio = response.data?.folio || folio;

      let noteCreated = null;
      if (paymentMethod === 'PPD') {
        try {
          const today = new Date();
          const due = new Date();
          due.setDate(today.getDate() + 30);
          const todayISO = today.toISOString().split('T')[0];
          const dueISO = due.toISOString().split('T')[0];

          const useCatalogClient = selectedClientId && selectedClientId !== 'default';
          const notePayload = {
            type: 'receivable',
            concept: `Venta a crédito - ${saleFolio}`,
            description: `Venta generada desde POS. Folio venta: ${saleFolio}.`,
            amount: total,
            issueDate: todayISO,
            dueDate: dueISO,
            notes: `Auto-generada desde venta ${saleFolio}.`,
          };
          if (useCatalogClient) {
            notePayload.clienteId = selectedClientId;
          } else {
            notePayload.contactName = customer.nombre || 'PUBLICO EN GENERAL';
            notePayload.contactRfc = customer.rfc || 'XAXX010101000';
            notePayload.contactEmail = customer.email || '';
            notePayload.contactPhone = '';
          }

          noteCreated = await notesService.createNote(notePayload);
          toast.success(`Nota por cobrar creada: ${noteCreated.folio}`);
        } catch (noteErr) {
          toast.error(`Venta OK, pero no se pudo crear la nota: ${noteErr.message}`);
        }
      }

      // Generate and print thermal receipt
      const receiptHTML = generateThermalReceipt(saleData, saleFolio);
      printThermalReceipt(receiptHTML);

      const extraMsg = noteCreated
        ? `\nNota por cobrar: ${noteCreated.folio}`
        : '';
      alert(`Venta procesada exitosamente!\nFolio: ${saleFolio}\nTotal: $${total.toFixed(2)}${extraMsg}`);
      clearCart();

    } catch (error) {
      alert('Error al procesar la venta: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pos-page">
      <div className="page-title-hero">
        <div>
          <h1>🛒 Punto de Venta</h1>
          <p>Agrega productos al carrito, asigna un cliente y procesa la venta.</p>
        </div>
        <div className="row" style={{ marginTop: 12, gap: 8, flexWrap: 'wrap' }}>
          <Button
            variant="secondary"
            leftIcon={<span aria-hidden>🔄</span>}
            onClick={fetchProducts}
          >
            Actualizar catálogo
          </Button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '20px' }}>
        {/* Products Section */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h2>Catálogo de Productos</h2>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <BarcodeSearch
              localProducts={products}
              onProductFound={(p) => addToCart(p)}
              onError={(msg) => toast.error(msg)}
            />
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
                        {editingPriceId === item.id ? (
                          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            <input
                              type="number"
                              value={editingPriceValue}
                              onChange={(e) => setEditingPriceValue(e.target.value)}
                              placeholder="Nuevo precio"
                              autoFocus
                              style={{
                                flex: 1,
                                padding: '4px 6px',
                                fontSize: '12px',
                                borderRadius: '4px',
                                border: '1px solid #667eea',
                                boxSizing: 'border-box'
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleUpdateItemPrice(item.id, editingPriceValue);
                                } else if (e.key === 'Escape') {
                                  setEditingPriceId(null);
                                  setEditingPriceValue('');
                                }
                              }}
                            />
                            <button
                              onClick={() => handleUpdateItemPrice(item.id, editingPriceValue)}
                              style={{
                                padding: '4px 8px',
                                fontSize: '11px',
                                backgroundColor: '#10b981',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: '600'
                              }}
                            >
                              ✓
                            </button>
                            <button
                              onClick={() => {
                                setEditingPriceId(null);
                                setEditingPriceValue('');
                              }}
                              style={{
                                padding: '4px 8px',
                                fontSize: '11px',
                                backgroundColor: '#ef4444',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <p
                            onClick={() => {
                              setEditingPriceId(item.id);
                              setEditingPriceValue(item.valorUnitario.toString());
                            }}
                            style={{
                              margin: 0,
                              fontSize: '12px',
                              color: '#667eea',
                              cursor: 'pointer',
                              fontWeight: '600',
                              textDecoration: 'underline'
                            }}
                            title="Click para editar precio"
                          >
                            ${item.valorUnitario.toFixed(2)} c/u
                          </p>
                        )}
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

              {/* Totals — ported to .stats-grid / .stat-card for the pwa visual identity */}
              <div style={{ padding: '15px', backgroundColor: '#f8f9fa', borderBottom: '1px solid #e9ecef' }}>
                <div className="stats-grid" style={{ marginBottom: 0 }}>
                  <div className="stat-card">
                    <div className="stat-card__value">${calculateSubtotal().toFixed(2)}</div>
                    <div className="stat-card__label">Subtotal</div>
                  </div>
                  <div className="stat-card info">
                    <div className="stat-card__value">${calculateTax().toFixed(2)}</div>
                    <div className="stat-card__label">IVA 16%</div>
                  </div>
                  <div className="stat-card success" style={{ gridColumn: 'span 2' }}>
                    <div className="stat-card__value" style={{ color: 'var(--brand-500)' }}>
                      ${calculateTotal().toFixed(2)}
                    </div>
                    <div className="stat-card__label">Total</div>
                  </div>
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
                    placeholder="Buscar cliente por nombre o RFC..."
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    disabled={loadingClients}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      marginBottom: '8px',
                      fontSize: '12px',
                      borderRadius: '6px',
                      border: '1px solid #dee2e6',
                      backgroundColor: '#fff',
                      boxSizing: 'border-box'
                    }}
                  />

                  {clientSearch && (
                    <div style={{
                      border: '1px solid #dee2e6',
                      borderTop: 'none',
                      borderRadius: '0 0 6px 6px',
                      backgroundColor: '#fff',
                      maxHeight: '200px',
                      overflowY: 'auto',
                      marginBottom: '12px',
                      fontSize: '12px'
                    }}>
                      <div
                        onClick={() => handleClientChange('default')}
                        style={{
                          padding: '8px 12px',
                          cursor: 'pointer',
                          borderBottom: '1px solid #f0f0f0',
                          backgroundColor: selectedClientId === 'default' ? '#f0f7ff' : 'transparent',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseOver={(e) => e.target.style.backgroundColor = '#f0f7ff'}
                        onMouseOut={(e) => e.target.style.backgroundColor = selectedClientId === 'default' ? '#f0f7ff' : 'transparent'}
                      >
                        PÚBLICO EN GENERAL
                      </div>
                      {filteredClients.length > 0 ? (
                        filteredClients.map(client => (
                          <div
                            key={client._id}
                            onClick={() => handleClientChange(client._id)}
                            style={{
                              padding: '8px 12px',
                              cursor: 'pointer',
                              borderBottom: '1px solid #f0f0f0',
                              backgroundColor: selectedClientId === client._id ? '#f0f7ff' : 'transparent',
                              transition: 'background-color 0.2s'
                            }}
                            onMouseOver={(e) => e.target.style.backgroundColor = '#f0f7ff'}
                            onMouseOut={(e) => e.target.style.backgroundColor = selectedClientId === client._id ? '#f0f7ff' : 'transparent'}
                          >
                            <div style={{ fontWeight: '600', color: '#333' }}>{client.nombre}</div>
                            <div style={{ fontSize: '11px', color: '#999' }}>RFC: {client.rfc}</div>
                          </div>
                        ))
                      ) : (
                        <div style={{ padding: '8px 12px', color: '#999', textAlign: 'center' }}>
                          No hay clientes que coincidan
                        </div>
                      )}
                    </div>
                  )}

                  {!clientSearch && (
                    <select
                      value={selectedClientId}
                      onChange={(e) => handleClientChange(e.target.value)}
                      disabled={loadingClients}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        marginBottom: '12px',
                        fontSize: '12px',
                        borderRadius: '6px',
                        border: '1px solid #dee2e6',
                        backgroundColor: '#fff',
                        cursor: loadingClients ? 'not-allowed' : 'pointer',
                        boxSizing: 'border-box'
                      }}
                    >
                      <option value="default">PÚBLICO EN GENERAL</option>
                      {clients.map(client => (
                        <option key={client._id} value={client._id}>
                          {client.nombre} ({client.rfc})
                        </option>
                      ))}
                    </select>
                  )}

                  <div style={{ fontSize: '11px', color: '#666', padding: '8px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                    <p style={{ margin: '0 0 4px 0', fontWeight: '600' }}>Detalles:</p>
                    <p style={{ margin: '2px 0' }}>RFC: <strong>{customer.rfc}</strong></p>
                    <p style={{ margin: '2px 0' }}>Nombre: <strong>{customer.nombre}</strong></p>
                    {customer.email && <p style={{ margin: '2px 0' }}>Email: <strong>{customer.email}</strong></p>}
                  </div>
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
