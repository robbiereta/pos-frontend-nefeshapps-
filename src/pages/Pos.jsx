import { useState, useEffect } from 'react';
import { salesService } from '../services/api';

const Pos = () => {
  const [cart, setCart] = useState([]);
  const [products, setProducts] = useState([
    {
      id: 1,
      descripcion: 'Hamburguesa Especial con Queso',
      valorUnitario: 350.00,
      claveProdServ: '50201501',
      claveUnidad: 'E48',
      unidad: 'Pieza',
      objetoImp: '02',
      categoria: 'Comida'
    },
    {
      id: 2,
      descripcion: 'Refresco 600ml',
      valorUnitario: 30.00,
      claveProdServ: '50202304',
      claveUnidad: 'E48',
      unidad: 'Pieza',
      objetoImp: '02',
      categoria: 'Bebidas'
    },
    {
      id: 3,
      descripcion: 'Papas Fritas Grandes',
      valorUnitario: 70.00,
      claveProdServ: '50201501',
      claveUnidad: 'E48',
      unidad: 'Pieza',
      objetoImp: '02',
      categoria: 'Comida'
    },
    {
      id: 4,
      descripcion: 'Helado de Vainilla',
      valorUnitario: 70.00,
      claveProdServ: '50221800',
      claveUnidad: 'E48',
      unidad: 'Pieza',
      objetoImp: '02',
      categoria: 'Postres'
    }
  ]);
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
  const [lastSale, setLastSale] = useState(null);

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
        status: 'pending',
        salesType: 'pos',
        notes: 'Venta generada desde POS',
        source: 'pos-frontend'
      };

      const response = await salesService.createSale(saleData);

      setLastSale(response.data);
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
          <h2>Catálogo de Productos</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
            {products.map(product => (
              <div key={product.id} style={{ 
                border: '1px solid #ddd', 
                padding: '15px', 
                borderRadius: '8px',
                cursor: 'pointer',
                backgroundColor: '#f9f9f9'
              }} onClick={() => addToCart(product)}>
                <h4>{product.descripcion}</h4>
                <p style={{ color: '#666', fontSize: '0.9em' }}>{product.categoria}</p>
                <p style={{ fontSize: '1.2em', fontWeight: 'bold', color: '#2c5aa0' }}>
                  ${product.valorUnitario.toFixed(2)} <span style={{ fontSize: '0.8em', color: '#666' }}>(IVA incl.)</span>
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Cart Section */}
        <div>
          <h2>Carrito de Compras</h2>
          
          {cart.length === 0 ? (
            <p>El carrito está vacío</p>
          ) : (
            <div>
              {cart.map(item => (
                <div key={item.id} style={{ 
                  border: '1px solid #eee', 
                  padding: '10px', 
                  marginBottom: '10px',
                  borderRadius: '4px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h4>{item.descripcion}</h4>
                      <p>${item.valorUnitario.toFixed(2)} c/u (IVA incl.)</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button 
                        onClick={() => updateQuantity(item.id, item.cantidad - 1)}
                        style={{ width: '30px', height: '30px' }}
                      >-</button>
                      <span>{item.cantidad}</span>
                      <button 
                        onClick={() => updateQuantity(item.id, item.cantidad + 1)}
                        style={{ width: '30px', height: '30px' }}
                      >+</button>
                      <button 
                        onClick={() => removeFromCart(item.id)}
                        style={{ background: '#ff4444', color: 'white' }}
                      >×</button>
                    </div>
                  </div>
                  <p style={{ textAlign: 'right', fontWeight: 'bold' }}>
                    ${item.importe.toFixed(2)}
                  </p>
                </div>
              ))}

              {/* Totals */}
              <div style={{ border: '1px solid #ddd', padding: '15px', marginTop: '20px' }}>
                <h3>Resumen</h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span>Subtotal:</span>
                  <span>${calculateSubtotal().toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span>IVA (16%):</span>
                  <span>${calculateTax(calculateSubtotal()).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '1.2em' }}>
                  <span>Total:</span>
                  <span>${calculateTotal().toFixed(2)}</span>
                </div>
              </div>

              {/* Payment Methods */}
              <div style={{ marginTop: '20px' }}>
                <h3>Método de Pago</h3>
                <div style={{ marginBottom: '10px' }}>
                  <label>Método:</label>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} style={{ marginLeft: '10px' }}>
                    <option value="PUE">PUE (Pago en una sola exhibición)</option>
                    <option value="PPD">PPD (Pago en parcialidades o diferido)</option>
                  </select>
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <label>Forma:</label>
                  <select value={paymentForm} onChange={(e) => setPaymentForm(e.target.value)} style={{ marginLeft: '10px' }}>
                    <option value="01">01 - Efectivo</option>
                    <option value="02">02 - Cheque nominativo</option>
                    <option value="03">03 - Transferencia electrónica</option>
                    <option value="04">04 - Tarjeta de crédito</option>
                    <option value="28">28 - Tarjeta de débito</option>
                  </select>
                </div>
              </div>

              {/* Customer Info */}
              <div style={{ marginTop: '20px' }}>
                <h3>Datos del Cliente</h3>
                <div style={{ marginBottom: '10px' }}>
                  <label> RFC:</label>
                  <input 
                    type="text" 
                    value={customer.rfc} 
                    onChange={(e) => setCustomer({...customer, rfc: e.target.value})}
                    style={{ marginLeft: '10px', width: '150px' }}
                  />
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <label>Nombre:</label>
                  <input 
                    type="text" 
                    value={customer.nombre} 
                    onChange={(e) => setCustomer({...customer, nombre: e.target.value})}
                    style={{ marginLeft: '10px', width: '200px' }}
                  />
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <label>Email:</label>
                  <input 
                    type="email" 
                    value={customer.email} 
                    onChange={(e) => setCustomer({...customer, email: e.target.value})}
                    style={{ marginLeft: '10px', width: '200px' }}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button 
                  onClick={processSale}
                  disabled={loading || cart.length === 0}
                  style={{ 
                    flex: 1, 
                    padding: '15px',
                    backgroundColor: loading ? '#ccc' : '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '16px',
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {loading ? 'Procesando...' : 'Procesar Venta'}
                </button>
                <button 
                  onClick={clearCart}
                  disabled={cart.length === 0}
                  style={{ 
                    padding: '15px 30px',
                    backgroundColor: '#f44336',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Last Sale Info */}
      {lastSale && (
        <div style={{ 
          marginTop: '30px', 
          padding: '20px', 
          backgroundColor: '#e8f5e8', 
          borderRadius: '8px',
          border: '1px solid #4CAF50'
        }}>
          <h3>Última Venta Realizada</h3>
          <p><strong>Folio:</strong> {lastSale.folio}</p>
          <p><strong>Total:</strong> ${lastSale.total.toFixed(2)}</p>
          <p><strong>Fecha:</strong> {new Date(lastSale.saleDate).toLocaleString('es-MX')}</p>
          <p><strong>Estado:</strong> {lastSale.status}</p>
        </div>
      )}
    </div>
  );
};

export default Pos;
