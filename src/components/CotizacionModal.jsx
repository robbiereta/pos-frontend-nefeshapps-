import { useState, useEffect, useMemo } from 'react';
import { cotizacionService } from '../services/cotizacionService';
import { productService } from '../services/productService';
import { useToast } from './ui/Toast.jsx';
import './Modal.css';
import './CotizacionModal.css';

const fmt = (n) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0);

const todayPlusDays = (d = 15) => {
  const x = new Date();
  x.setDate(x.getDate() + d);
  return x.toISOString().slice(0, 10);
};

const emptyItem = () => ({
  descripcion: '',
  sku: '',
  claveProdServ: '01010101',
  claveUnidad: 'H87',
  unidad: 'Pieza',
  cantidad: 1,
  precioUnitario: 0,
  descuento: 0,
});

const calcItem = (it) => {
  const cantidad = Number(it.cantidad) || 0;
  const precio = Number(it.precioUnitario) || 0;
  const desc = Number(it.descuento) || 0;
  const sub = cantidad * precio * (1 - desc / 100);
  const iva = sub * 0.16;
  return { subtotal: round2(sub), iva: round2(iva), total: round2(sub + iva) };
};
const round2 = (n) => Math.round(n * 100) / 100;

export default function CotizacionModal({ cotizacion, onClose, onSaved }) {
  const isEdit = !!cotizacion;
  const toast = useToast();

  const [cliente, setCliente] = useState(cotizacion?.cliente || '');
  const [clienteNombre, setClienteNombre] = useState(cotizacion?.clienteSnapshot?.nombre || '');
  const [clienteRfc, setClienteRfc] = useState(cotizacion?.clienteSnapshot?.rfc || '');
  const [clienteEmail, setClienteEmail] = useState(cotizacion?.clienteSnapshot?.email || '');
  const [clienteTelefono, setClienteTelefono] = useState(cotizacion?.clienteSnapshot?.telefono || '');
  const [clienteDireccion, setClienteDireccion] = useState(cotizacion?.clienteSnapshot?.direccion || '');

  const [items, setItems] = useState(cotizacion?.items?.length ? cotizacion.items.map((it) => ({
    descripcion: it.descripcion || '',
    sku: it.sku || '',
    claveProdServ: it.claveProdServ || '01010101',
    claveUnidad: it.claveUnidad || 'H87',
    unidad: it.unidad || 'Pieza',
    cantidad: it.cantidad || 1,
    precioUnitario: it.precioUnitario || 0,
    descuento: it.descuento || 0,
  })) : [emptyItem()]);

  const [vigencia, setVigencia] = useState(
    cotizacion?.vigencia ? new Date(cotizacion.vigencia).toISOString().slice(0, 10) : todayPlusDays(15)
  );
  const [condiciones, setCondiciones] = useState(cotizacion?.condiciones || '');
  const [notas, setNotas] = useState(cotizacion?.notas || '');
  const [usoCFDI, setUsoCFDI] = useState(cotizacion?.usoCFDI || 'G03');
  const [formaPago, setFormaPago] = useState(cotizacion?.formaPago || '99');
  const [metodoPago, setMetodoPago] = useState(cotizacion?.metodoPago || 'PUE');

  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  const totales = useMemo(() => {
    let subtotal = 0, iva = 0;
    for (const it of items) {
      const c = calcItem(it);
      subtotal += c.subtotal;
      iva += c.iva;
    }
    return { subtotal: round2(subtotal), iva: round2(iva), total: round2(subtotal + iva) };
  }, [items]);

  // Búsqueda de productos del catálogo
  useEffect(() => {
    if (!productSearch || productSearch.length < 2) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await productService.getProducts({ searchQuery: productSearch, limit: 8 });
        const listRaw = r?.data?.products;
        const list = Array.isArray(listRaw) ? listRaw : [];
        setSearchResults(list);
      } catch (e) { /* ignore */ }
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [productSearch]);

  const addItemFromProduct = (p) => {
    setItems((prev) => [...prev, {
      productId: p._id,
      descripcion: p.nombre,
      sku: p.sku || '',
      claveProdServ: p.claveProdServ || '01010101',
      claveUnidad: p.claveUnidad || 'H87',
      unidad: p.unidad || 'Pieza',
      cantidad: 1,
      precioUnitario: p.precioUnitario || p.precioVenta || 0,
      descuento: 0,
    }]);
    setProductSearch('');
    setSearchResults([]);
  };

  const addEmptyItem = () => setItems((p) => [...p, emptyItem()]);

  const updateItem = (idx, field, value) => {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };

  const removeItem = (idx) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    // Validación
    if (items.length === 0) {
      toast?.error?.('Agrega al menos un item');
      return;
    }
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.descripcion) { toast?.error?.(`Item ${i + 1}: descripción requerida`); return; }
      if (!it.cantidad || Number(it.cantidad) <= 0) { toast?.error?.(`Item ${i + 1}: cantidad debe ser > 0`); return; }
      if (Number(it.precioUnitario) < 0) { toast?.error?.(`Item ${i + 1}: precio no puede ser negativo`); return; }
    }

    setSaving(true);
    const payload = {
      cliente: cliente || undefined,
      clienteSnapshot: clienteNombre ? {
        nombre: clienteNombre,
        rfc: clienteRfc,
        email: clienteEmail,
        telefono: clienteTelefono,
        direccion: clienteDireccion,
      } : undefined,
      items: items.map((it) => ({
        ...it,
        cantidad: Number(it.cantidad),
        precioUnitario: Number(it.precioUnitario),
        descuento: Number(it.descuento || 0),
      })),
      vigencia: vigencia ? new Date(vigencia).toISOString() : undefined,
      condiciones, notas, usoCFDI, formaPago, metodoPago,
    };

    try {
      const res = isEdit
        ? await cotizacionService.update(cotizacion._id, payload)
        : await cotizacionService.create(payload);
      toast?.success?.(res?.message || 'Guardado');
      onSaved?.(res?.data?.cotizacion);
    } catch (err) {
      toast?.error?.(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content cotizacion-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? '✏️ Editar cotización' : '📋 Nueva cotización'}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Cliente */}
          <fieldset className="form-section">
            <legend>Cliente</legend>
            <div className="form-grid">
              <label className="full">
                Nombre / Razón social
                <input type="text" value={clienteNombre} onChange={(e) => setClienteNombre(e.target.value)} />
              </label>
              <label>
                RFC
                <input type="text" value={clienteRfc} onChange={(e) => setClienteRfc(e.target.value)} />
              </label>
              <label>
                Email
                <input type="email" value={clienteEmail} onChange={(e) => setClienteEmail(e.target.value)} />
              </label>
              <label>
                Teléfono
                <input type="text" value={clienteTelefono} onChange={(e) => setClienteTelefono(e.target.value)} />
              </label>
              <label className="full">
                Dirección
                <input type="text" value={clienteDireccion} onChange={(e) => setClienteDireccion(e.target.value)} />
              </label>
            </div>
          </fieldset>

          {/* Items */}
          <fieldset className="form-section">
            <legend>Items</legend>

            <div className="product-search">
              <input
                type="text"
                placeholder="🔍 Buscar producto del catálogo para añadir…"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
              />
              {searching && <small className="muted">buscando…</small>}
              {searchResults.length > 0 && (
                <ul className="search-results">
                  {searchResults.map((p) => (
                    <li key={p._id} onClick={() => addItemFromProduct(p)}>
                      <strong>{p.nombre}</strong> <small>{p.sku}</small>
                      <span className="price">{fmt(p.precioUnitario)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <table className="items-table">
              <thead>
                <tr>
                  <th style={{ width: '40%' }}>Descripción</th>
                  <th>Cant.</th>
                  <th>P. Unit</th>
                  <th>Desc%</th>
                  <th>Subtotal</th>
                  <th>IVA</th>
                  <th>Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => {
                  const c = calcItem(it);
                  return (
                    <tr key={idx}>
                      <td>
                        <input type="text" value={it.descripcion} onChange={(e) => updateItem(idx, 'descripcion', e.target.value)} />
                        <input type="text" className="sku-input" placeholder="SKU" value={it.sku} onChange={(e) => updateItem(idx, 'sku', e.target.value)} />
                      </td>
                      <td><input type="number" step="0.0001" min="0" value={it.cantidad} onChange={(e) => updateItem(idx, 'cantidad', e.target.value)} /></td>
                      <td><input type="number" step="0.01" min="0" value={it.precioUnitario} onChange={(e) => updateItem(idx, 'precioUnitario', e.target.value)} /></td>
                      <td><input type="number" step="0.01" min="0" max="100" value={it.descuento} onChange={(e) => updateItem(idx, 'descuento', e.target.value)} /></td>
                      <td className="num">{fmt(c.subtotal)}</td>
                      <td className="num">{fmt(c.iva)}</td>
                      <td className="num strong">{fmt(c.total)}</td>
                      <td>
                        <button type="button" className="btn-icon-danger" onClick={() => removeItem(idx)} title="Quitar">🗑</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <button type="button" className="btn btn-secondary" onClick={addEmptyItem}>
              + Agregar item libre
            </button>
          </fieldset>

          {/* Otros */}
          <fieldset className="form-section">
            <legend>Detalles</legend>
            <div className="form-grid">
              <label>
                Vigencia
                <input type="date" value={vigencia} onChange={(e) => setVigencia(e.target.value)} />
              </label>
              <label>
                Uso CFDI
                <input type="text" value={usoCFDI} onChange={(e) => setUsoCFDI(e.target.value)} maxLength={3} />
              </label>
              <label>
                Forma de pago
                <input type="text" value={formaPago} onChange={(e) => setFormaPago(e.target.value)} maxLength={2} />
              </label>
              <label>
                Método de pago
                <select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}>
                  <option value="PUE">PUE — Pago en una sola exhibición</option>
                  <option value="PPD">PPD — Pago en parcialidades o diferido</option>
                </select>
              </label>
              <label className="full">
                Condiciones
                <textarea rows="2" value={condiciones} onChange={(e) => setCondiciones(e.target.value)} />
              </label>
              <label className="full">
                Notas
                <textarea rows="2" value={notas} onChange={(e) => setNotas(e.target.value)} />
              </label>
            </div>
          </fieldset>

          {/* Totales */}
          <div className="totals-box">
            <div><span>Subtotal</span><strong>{fmt(totales.subtotal)}</strong></div>
            <div><span>IVA (16%)</span><strong>{fmt(totales.iva)}</strong></div>
            <div className="total-final"><span>TOTAL</span><strong>{fmt(totales.total)}</strong></div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear cotización'}
          </button>
        </div>
      </div>
    </div>
  );
}
