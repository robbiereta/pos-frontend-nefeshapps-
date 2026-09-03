import { useState, useEffect, useRef } from 'react';
import { productService } from '../services/productService';
import { categoryService } from '../services/categoryService';
import { useToast } from './ui/Toast.jsx';
import './Modal.css';

/**
 * Quick-add product modal for the POS.
 *
 * Lets the cashier add a product to the cart without leaving the sale flow:
 *  - 🔍 Buscar:  search by name or SKU, then set qty + optional custom price
 *  - ✨ Crear:   inline-create a brand new product and add it to the cart
 *
 * The created/selected product is sent back via `onAddToCart(product, quantity)`
 * — the parent (Pos) is responsible for the cart merge / IVA math so this stays
 * consistent with the rest of the cart.
 */
export default function QuickAddProductModal({ onClose, onAddToCart }) {
  const [tab, setTab] = useState('search'); // 'search' | 'create'
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState('');
  const [creating, setCreating] = useState(false);
  const searchInputRef = useRef(null);
  const toast = useToast();

  // Focus search input whenever we land on the search tab
  useEffect(() => {
    if (tab === 'search') {
      // small delay so the input is mounted
      const t = setTimeout(() => searchInputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [tab]);

  // Debounced search
  useEffect(() => {
    if (tab !== 'search') return undefined;
    if (!query.trim()) {
      setResults([]);
      return undefined;
    }
    const timer = setTimeout(() => searchProducts(query), 300);
    return () => clearTimeout(timer);
  }, [query, tab]);

  const searchProducts = async (q) => {
    setLoadingSearch(true);
    try {
      const res = await productService.getProducts({
        search: q.trim(),
        limit: 20,
        activo: 'true',
      });
      // response shape: { data: { products: [...], pagination } } per backend
      const payload = res?.data?.products ?? res?.data ?? res?.products ?? [];
      setResults(Array.isArray(payload) ? payload : []);
    } catch (err) {
      setResults([]);
      toast.error(err?.message || 'Error al buscar productos');
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleSelectProduct = (product) => {
    setSelectedProduct(product);
    const basePrice = product.precioVenta ?? product.precioUnitario ?? 0;
    setPrice(String(basePrice));
    setQuantity(1);
  };

  const handleAddSelected = () => {
    if (!selectedProduct) return;
    const qty = Math.max(1, parseInt(quantity, 10) || 1);
    const unitPrice = parseFloat(price) || selectedProduct.precioVenta || selectedProduct.precioUnitario || 0;
    onAddToCart(
      {
        ...selectedProduct,
        id: selectedProduct._id || selectedProduct.id,
        descripcion: selectedProduct.nombre || selectedProduct.descripcion || '',
        valorUnitario: unitPrice,
      },
      qty,
    );
    onClose();
  };

  // ── Create tab ─────────────────────────────────────────────────────────
  const initialCreate = {
    nombre: '',
    sku: '',
    precioVenta: '',
    categoria: 'General',
    categoriaId: '',
    claveUnidad: 'E48',
    claveProdServ: '01010101',
  };
  const [formData, setFormData] = useState(initialCreate);
  const [formErrors, setFormErrors] = useState({});
  const [categories, setCategories] = useState([]);

  // Fetch the tenant's active categories once when the modal opens.
  // Mirrors ProductModal: the user picks a category and the SAT
  // codes auto-fill (the backend re-applies the inheritance at
  // write time so a category rename in admin doesn't mutate
  // historical product SAT codes).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await categoryService.list({ includeInactive: false });
        if (!cancelled) setCategories(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setCategories([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const onCategoryChange = (catId) => {
    if (!catId) {
      setFormData((s) => ({ ...s, categoriaId: '', categoria: 'General' }));
      return;
    }
    const cat = categories.find((c) => c._id === catId);
    if (!cat) return;
    setFormData((s) => ({
      ...s,
      categoriaId: cat._id,
      categoria: cat.nombre,
      claveProdServ: cat.claveProdServ,
      claveUnidad: cat.claveUnidad,
    }));
  };

  const handleCreateChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) setFormErrors((prev) => ({ ...prev, [name]: null }));
  };

  const validateCreate = () => {
    const errs = {};
    if (!formData.nombre.trim()) errs.nombre = 'El nombre es requerido';
    const price = parseFloat(formData.precioVenta);
    if (!formData.precioVenta || Number.isNaN(price) || price <= 0) {
      errs.precioVenta = 'Precio de venta requerido';
    }
    return errs;
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const errs = validateCreate();
    if (Object.keys(errs).length) {
      setFormErrors(errs);
      return;
    }
    setCreating(true);
    try {
      const payload = {
        ...formData,
        // Don't send an empty string for categoriaId — the backend
        // helper short-circuits on truthy values and we'd rather
        // have `undefined` so the existing categoria string stays.
        categoriaId: formData.categoriaId || undefined,
        precioVenta: parseFloat(formData.precioVenta),
        // also keep legacy field for backends that still read it
        precioUnitario: parseFloat(formData.precioVenta),
        activo: true,
      };
      const res = await productService.createProduct(payload);
      const newProduct = res?.data ?? res;
      const qty = Math.max(1, parseInt(quantity, 10) || 1);
      toast.success(`Producto "${newProduct.nombre}" creado`);
      onAddToCart(
        {
          ...newProduct,
          id: newProduct._id || newProduct.id,
          descripcion: newProduct.nombre,
          valorUnitario: parseFloat(formData.precioVenta),
        },
        qty,
      );
      onClose();
    } catch (err) {
      setFormErrors({ form: err?.message || 'Error al crear producto' });
    } finally {
      setCreating(false);
    }
  };

  const switchToCreate = () => {
    setTab('create');
    setSelectedProduct(null);
    setFormData({ ...initialCreate, nombre: query });
  };

  const resetCreate = () => {
    setFormData({ ...initialCreate });
    setFormErrors({});
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 520, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div className="modal-header">
          <h2>➕ Agregar Producto</h2>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">&times;</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '2px solid #eee', padding: '0 16px' }}>
          <button
            type="button"
            onClick={() => { setTab('search'); setSelectedProduct(null); }}
            style={tabBtnStyle(tab === 'search')}
          >
            🔍 Buscar
          </button>
          <button
            type="button"
            onClick={switchToCreate}
            style={tabBtnStyle(tab === 'create')}
          >
            ✨ Crear nuevo
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>

          {/* SEARCH TAB — list view */}
          {tab === 'search' && !selectedProduct && (
            <div>
              <div style={{ position: 'relative', marginBottom: '12px' }}>
                <input
                  ref={searchInputRef}
                  type="text"
                  autoComplete="off"
                  placeholder="Buscar por nombre o SKU..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px', paddingLeft: '36px',
                    fontSize: '14px', border: '2px solid #e0e0e0', borderRadius: '8px',
                    boxSizing: 'border-box', outline: 'none', transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = '#667eea')}
                  onBlur={(e) => (e.target.style.borderColor = '#e0e0e0')}
                />
                <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px', pointerEvents: 'none' }}>🔍</span>
              </div>

              {loadingSearch && (
                <p style={{ textAlign: 'center', color: '#999', fontSize: '13px' }}>Buscando…</p>
              )}

              {!loadingSearch && query && results.length === 0 && (
                <p style={{ textAlign: 'center', color: '#999', fontSize: '13px', margin: '16px 0' }}>
                  No se encontraron productos para &quot;{query}&quot;
                </p>
              )}

              <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                {results.map((product) => (
                  <div
                    key={product._id || product.id}
                    onClick={() => handleSelectProduct(product)}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 12px', marginBottom: '6px', borderRadius: '8px',
                      border: '1px solid #eee', cursor: 'pointer', transition: 'all 0.15s',
                      background: '#f9f9f9',
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.borderColor = '#667eea'; e.currentTarget.style.background = '#f0f4ff'; }}
                    onMouseOut={(e) => { e.currentTarget.style.borderColor = '#eee'; e.currentTarget.style.background = '#f9f9f9'; }}
                  >
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '13px', color: '#333' }}>{product.nombre}</div>
                      <div style={{ fontSize: '11px', color: '#999' }}>
                        {product.sku ? `SKU: ${product.sku} · ` : ''}{product.categoria || 'Sin categoría'}
                      </div>
                    </div>
                    <div style={{ fontWeight: '700', color: '#667eea', fontSize: '14px', whiteSpace: 'nowrap', marginLeft: '12px' }}>
                      ${(product.precioVenta || product.precioUnitario || 0).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>

              {query && !loadingSearch && results.length === 0 && (
                <p style={{ textAlign: 'center', marginTop: '12px', fontSize: '13px', color: '#666' }}>
                  ¿No lo encontraste?{' '}
                  <button
                    type="button"
                    onClick={switchToCreate}
                    style={{ background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', fontWeight: '600', textDecoration: 'underline' }}
                  >
                    Créalo aquí
                  </button>
                </p>
              )}
            </div>
          )}

          {/* SEARCH TAB — selected product: pick qty + price */}
          {tab === 'search' && selectedProduct && (
            <div>
              <div style={{
                background: 'linear-gradient(135deg, #667eea22, #764ba222)',
                border: '2px solid #667eea44', borderRadius: '10px', padding: '14px',
                marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '15px', color: '#333' }}>{selectedProduct.nombre}</div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    {selectedProduct.sku ? `SKU: ${selectedProduct.sku} · ` : ''}{selectedProduct.categoria || 'General'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#999', marginTop: '2px' }}>
                    Precio catálogo: <strong>${(selectedProduct.precioVenta || selectedProduct.precioUnitario || 0).toFixed(2)}</strong>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedProduct(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#999', padding: '4px' }}
                  aria-label="Cambiar producto"
                >
                  ✕
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={labelStyle}>Cantidad *</label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Precio unitario (IVA incl.)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0.00"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ background: '#f8f9fa', borderRadius: '8px', padding: '12px', marginBottom: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Importe total</div>
                <div style={{ fontSize: '24px', fontWeight: '800', color: '#667eea' }}>
                  ${((parseFloat(price) || parseFloat(selectedProduct.precioVenta) || 0) * quantity).toFixed(2)}
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddSelected}
                style={{
                  width: '100%', padding: '12px',
                  background: 'linear-gradient(135deg, #667eea, #764ba2)',
                  color: 'white', border: 'none', borderRadius: '8px',
                  fontSize: '14px', fontWeight: '700', cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(102,126,234,0.3)',
                }}
              >
                ➕ Agregar al carrito (×{quantity})
              </button>
            </div>
          )}

          {/* CREATE TAB */}
          {tab === 'create' && (
            <form onSubmit={handleCreate}>
              <div style={{ display: 'grid', gap: '10px' }}>
                <div>
                  <label style={labelStyle}>Nombre *</label>
                  <input
                    type="text"
                    name="nombre"
                    value={formData.nombre}
                    onChange={handleCreateChange}
                    placeholder="Ej: Hamburguesa Especial"
                    style={{ ...inputStyle, borderColor: formErrors.nombre ? '#dc3545' : '#dee2e6' }}
                  />
                  {formErrors.nombre && <span style={errorText}>{formErrors.nombre}</span>}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={labelStyle}>SKU</label>
                    <input
                      type="text"
                      name="sku"
                      value={formData.sku}
                      onChange={handleCreateChange}
                      placeholder="Opcional"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Categoría</label>
                    <select
                      name="categoriaId"
                      value={formData.categoriaId || ''}
                      onChange={(e) => onCategoryChange(e.target.value)}
                      style={inputStyle}
                    >
                      <option value="">— General (sin categoría) —</option>
                      {categories.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.nombre} ({c.claveProdServ} / {c.claveUnidad})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {categories.length === 0 && (
                  <small style={{ color: '#666', fontSize: '11px', marginTop: '-4px' }}>
                    Aún no hay categorías. Crea una en
                    {' '}<a href="/categories" target="_blank" rel="noreferrer">Categorías</a>
                    {' '}para heredar los códigos SAT automáticamente.
                  </small>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={labelStyle}>Precio venta (IVA incl.) *</label>
                    <input
                      type="number"
                      name="precioVenta"
                      value={formData.precioVenta}
                      onChange={handleCreateChange}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      style={{ ...inputStyle, borderColor: formErrors.precioVenta ? '#dc3545' : '#dee2e6' }}
                    />
                    {formErrors.precioVenta && <span style={errorText}>{formErrors.precioVenta}</span>}
                  </div>
                  <div>
                    <label style={labelStyle}>Cantidad</label>
                    <input
                      type="number"
                      value={quantity}
                      min="1"
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={labelStyle}>Clave SAT producto (8 dígitos)</label>
                    <input
                      type="text"
                      name="claveProdServ"
                      value={formData.claveProdServ}
                      onChange={handleCreateChange}
                      placeholder="01010101"
                      style={inputStyle}
                      maxLength={8}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Clave unidad SAT</label>
                    <input
                      type="text"
                      name="claveUnidad"
                      value={formData.claveUnidad}
                      onChange={handleCreateChange}
                      placeholder="E48 / H87"
                      style={inputStyle}
                      maxLength={3}
                    />
                  </div>
                </div>

                {formErrors.form && (
                  <div style={{ background: '#fff5f5', border: '1px solid #dc3545', borderRadius: '6px', padding: '8px', fontSize: '13px', color: '#dc3545' }}>
                    {formErrors.form}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{ flex: 1, padding: '10px', background: '#f0f0f0', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', color: '#666' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  style={{
                    flex: 2, padding: '10px',
                    background: creating ? '#aaa' : 'linear-gradient(135deg, #667eea, #764ba2)',
                    color: 'white', border: 'none', borderRadius: '8px',
                    fontWeight: '700',
                    cursor: creating ? 'not-allowed' : 'pointer',
                    boxShadow: creating ? 'none' : '0 4px 12px rgba(102,126,234,0.3)',
                  }}
                >
                  {creating ? '⏳ Creando…' : `✨ Crear y agregar (×${quantity})`}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

const tabBtnStyle = (active) => ({
  flex: 1, padding: '10px', background: 'none', border: 'none',
  borderBottom: active ? '3px solid #667eea' : '3px solid transparent',
  cursor: 'pointer', fontWeight: active ? '700' : '400',
  color: active ? '#667eea' : '#999', fontSize: '14px',
  transition: 'all 0.2s',
});

const inputStyle = {
  width: '100%', padding: '8px 10px', fontSize: '13px',
  borderRadius: '6px', border: '1px solid #dee2e6',
  boxSizing: 'border-box', outline: 'none',
};

const labelStyle = {
  fontSize: '12px', fontWeight: '600', color: '#495057',
  display: 'block', marginBottom: '4px',
};

const errorText = { fontSize: '11px', color: '#dc3545' };
