import { useState, useEffect } from 'react';
import { productService } from '../services/productService';
import ProductModal from '../components/ProductModal';
import QuantityModal from '../components/QuantityModal';
import './Products.css';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('true');
  const [categories, setCategories] = useState([]);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Inventory Stats
  const [stats, setStats] = useState(null);
  const [lowStockProducts, setLowStockProducts] = useState([]);

  // Bulk selection
  const [selectedProducts, setSelectedProducts] = useState([]);

  useEffect(() => {
    const controller = new AbortController();
    let timeouts = [];

    // Stagger requests to avoid rate limiting
    timeouts.push(setTimeout(() => fetchProducts(), 0));
    timeouts.push(setTimeout(() => fetchStats(), 300));
    timeouts.push(setTimeout(() => fetchLowStock(), 600));

    return () => {
      controller.abort();
      timeouts.forEach(t => clearTimeout(t));
    };
  }, [page, searchQuery, categoryFilter, statusFilter]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        page,
        limit,
      };

      if (searchQuery) params.searchQuery = searchQuery;
      if (categoryFilter) params.categoria = categoryFilter;
      if (statusFilter) params.activo = statusFilter;

      const response = await productService.getProducts(params);

      const productsList = response.data?.products || response.data || [];
      const pagination = response.data?.pagination || {};

      setProducts(productsList);
      setTotalPages(pagination.pages || 1);
      setTotal(pagination.total || 0);

      // Extract unique categories
      const uniqueCategories = [...new Set(productsList.map(p => p.categoria).filter(Boolean))];
      setCategories(uniqueCategories);
    } catch (err) {
      setError(err.message || 'Error al cargar productos');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await productService.getInventoryStats();
      const statsData = response.data?.stats || response.data || {};
      setStats(statsData);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const fetchLowStock = async () => {
    try {
      const response = await productService.getLowStockProducts();
      const lowStockData = response.data?.products || response.data || [];
      setLowStockProducts(lowStockData);
    } catch (err) {
      console.error('Error fetching low stock:', err);
    }
  };

  const handleCreate = async (productData) => {
    try {
      await productService.createProduct(productData);
      setSuccess('Producto creado exitosamente');
      setShowCreateModal(false);
      fetchProducts();
      fetchStats();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message || 'Error al crear producto');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleEdit = async (productData) => {
    try {
      await productService.updateProduct(selectedProduct._id, productData);
      setSuccess('Producto actualizado exitosamente');
      setShowEditModal(false);
      setSelectedProduct(null);
      fetchProducts();
      fetchStats();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message || 'Error al actualizar producto');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleDelete = async (productId) => {
    if (!confirm('¿Está seguro de eliminar este producto?')) return;

    try {
      await productService.deleteProduct(productId);
      setSuccess('Producto eliminado exitosamente');
      fetchProducts();
      fetchStats();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message || 'Error al eliminar producto');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleUpdateQuantity = async (operacion, cantidad) => {
    try {
      await productService.updateQuantity(selectedProduct._id, operacion, cantidad);
      setSuccess('Cantidad actualizada exitosamente');
      setShowQuantityModal(false);
      setSelectedProduct(null);
      fetchProducts();
      fetchStats();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message || 'Error al actualizar cantidad');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleBulkUpdate = async (updates) => {
    if (selectedProducts.length === 0) {
      setError('Seleccione al menos un producto');
      setTimeout(() => setError(null), 3000);
      return;
    }

    try {
      await productService.bulkUpdate(selectedProducts, updates);
      setSuccess(`${selectedProducts.length} productos actualizados exitosamente`);
      setSelectedProducts([]);
      fetchProducts();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message || 'Error al actualizar productos');
      setTimeout(() => setError(null), 3000);
    }
  };

  const toggleProductSelection = (productId) => {
    setSelectedProducts(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedProducts.length === products.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(products.map(p => p._id));
    }
  };

  const openEditModal = (product) => {
    setSelectedProduct(product);
    setShowEditModal(true);
  };

  const openQuantityModal = (product) => {
    setSelectedProduct(product);
    setShowQuantityModal(true);
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(value || 0);
  };

  const getStockBadge = (product) => {
    if (product.cantidad === 0) {
      return <span className="badge badge-danger">Sin stock</span>;
    }
    if (product.cantidadMinima && product.cantidad <= product.cantidadMinima) {
      return <span className="badge badge-warning">Stock bajo</span>;
    }
    return <span className="badge badge-success">Stock OK</span>;
  };

  return (
    <div className="products-page">
      <div className="page-header">
        <h1>Gestión de Productos</h1>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          + Nuevo Producto
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {/* Inventory Dashboard */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.totalProducts || 0}</div>
            <div className="stat-label">Total Productos</div>
          </div>
          <div className="stat-card success">
            <div className="stat-value">{stats.totalStock || 0}</div>
            <div className="stat-label">Unidades en Stock</div>
          </div>
          <div className="stat-card warning">
            <div className="stat-value">{stats.lowStockCount || 0}</div>
            <div className="stat-label">Stock Bajo</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{formatCurrency(stats.totalInventoryValue || 0)}</div>
            <div className="stat-label">Valor del Inventario</div>
          </div>
        </div>
      )}

      {/* Low Stock Alert */}
      {lowStockProducts.length > 0 && (
        <div className="card alert-card">
          <h3>⚠️ Productos con Stock Bajo</h3>
          <div className="low-stock-list">
            {lowStockProducts.slice(0, 5).map(product => (
              <div key={product._id} className="low-stock-item">
                <span className="product-name">{product.nombre}</span>
                <span className="product-stock">Stock: {product.cantidad} / Mínimo: {product.cantidadMinima}</span>
              </div>
            ))}
            {lowStockProducts.length > 5 && (
              <div className="more-items">+{lowStockProducts.length - 5} productos más</div>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card filters-card">
        <div className="filters-row">
          <input
            type="text"
            placeholder="Buscar por nombre, SKU o descripción..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="search-input"
          />
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="filter-select"
          >
            <option value="">Todas las categorías</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="filter-select"
          >
            <option value="">Todos los estados</option>
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
          </select>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedProducts.length > 0 && (
        <div className="card bulk-actions-card">
          <span>{selectedProducts.length} producto(s) seleccionado(s)</span>
          <div className="bulk-actions">
            <button
              className="btn btn-secondary"
              onClick={() => handleBulkUpdate({ activo: true })}
            >
              Activar
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => handleBulkUpdate({ activo: false })}
            >
              Desactivar
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => setSelectedProducts([])}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Products Table */}
      <div className="card">
        {loading ? (
          <div className="loading">Cargando productos...</div>
        ) : products.length === 0 ? (
          <div className="empty-state">
            <p>No se encontraron productos</p>
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              Crear primer producto
            </button>
          </div>
        ) : (
          <>
            <table className="invoice-table products-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={selectedProducts.length === products.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th>SKU</th>
                  <th>Nombre</th>
                  <th>Categoría</th>
                  <th>Precio Venta</th>
                  <th>Costo</th>
                  <th>Margen</th>
                  <th>Stock</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product._id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedProducts.includes(product._id)}
                        onChange={() => toggleProductSelection(product._id)}
                      />
                    </td>
                    <td className="sku-cell">{product.sku || 'N/A'}</td>
                    <td>
                      <div className="product-name-cell">
                        <strong>{product.nombre}</strong>
                        {product.descripcion && (
                          <small>{product.descripcion.substring(0, 50)}...</small>
                        )}
                      </div>
                    </td>
                    <td>{product.categoria || 'N/A'}</td>
                    <td>{formatCurrency(product.precioVenta || product.precioUnitario)}</td>
                    <td>{formatCurrency(product.costoPorUnidad)}</td>
                    <td>
                      {product.margenGanancia != null ? (
                        <span className={`margin ${product.margenGanancia > 30 ? 'positive' : 'neutral'}`}>
                          {product.margenGanancia.toFixed(1)}%
                        </span>
                      ) : (
                        'N/A'
                      )}
                    </td>
                    <td>
                      <div className="stock-cell">
                        <span className="stock-quantity">{product.cantidad || 0}</span>
                        {getStockBadge(product)}
                      </div>
                    </td>
                    <td>
                      <span className={`status ${product.activo ? 'completed' : 'pending'}`}>
                        {product.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn-icon"
                          onClick={() => openEditModal(product)}
                          title="Editar"
                        >
                          ✏️
                        </button>
                        <button
                          className="btn-icon"
                          onClick={() => openQuantityModal(product)}
                          title="Ajustar Stock"
                        >
                          📦
                        </button>
                        <button
                          className="btn-icon btn-danger"
                          onClick={() => handleDelete(product._id)}
                          title="Eliminar"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="pagination">
              <div className="pagination-info">
                Mostrando {(page - 1) * limit + 1} - {Math.min(page * limit, total)} de {total} productos
              </div>
              <div className="pagination-controls">
                <button
                  className="btn btn-secondary"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Anterior
                </button>
                <span className="page-indicator">
                  Página {page} de {totalPages}
                </span>
                <button
                  className="btn btn-secondary"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Siguiente
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <ProductModal
          onClose={() => setShowCreateModal(false)}
          onSave={handleCreate}
        />
      )}

      {showEditModal && selectedProduct && (
        <ProductModal
          product={selectedProduct}
          onClose={() => {
            setShowEditModal(false);
            setSelectedProduct(null);
          }}
          onSave={handleEdit}
        />
      )}

      {showQuantityModal && selectedProduct && (
        <QuantityModal
          product={selectedProduct}
          onClose={() => {
            setShowQuantityModal(false);
            setSelectedProduct(null);
          }}
          onSave={handleUpdateQuantity}
        />
      )}
    </div>
  );
}
