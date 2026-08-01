import { useState, useEffect } from 'react';
import ProductImageUpload from './ProductImageUpload';
import './Modal.css';

export default function ProductModal({ product, onClose, onSave }) {
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    sku: '',
    precioUnitario: '',
    precioVenta: '',
    costoPorUnidad: '0',
    cantidad: 0,
    cantidadMinima: '',
    cantidadMaxima: '',
    categoria: '',
    subcategoria: '',
    unidad: '',
    claveUnidad: 'H87',
    claveProdServ: '01010101',
    activo: true,
    tags: '',
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (product) {
      setFormData({
        nombre: product.nombre || '',
        descripcion: product.descripcion || '',
        sku: product.sku || '',
        precioUnitario: product.precioUnitario || '',
        precioVenta: product.precioVenta || '',
        costoPorUnidad: product.costoPorUnidad || '',
        cantidad: product.cantidad || 0,
        cantidadMinima: product.cantidadMinima || '',
        cantidadMaxima: product.cantidadMaxima || '',
        categoria: product.categoria || '',
        subcategoria: product.subcategoria || '',
        unidad: product.unidad || 'Pieza',
        claveUnidad: product.claveUnidad || 'H87',
        claveProdServ: product.claveProdServ || '01010101',
        activo: product.activo !== false,
        tags: Array.isArray(product.tags) ? product.tags.join(', ') : '',
      });
    }
  }, [product]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.nombre.trim()) {
      newErrors.nombre = 'El nombre es requerido';
    }

    if (!formData.precioUnitario || formData.precioUnitario <= 0) {
      newErrors.precioUnitario = 'El precio unitario debe ser mayor a 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validate()) return;

    const dataToSave = {
      ...formData,
      precioUnitario: parseFloat(formData.precioUnitario) || 0,
      precioVenta: formData.precioVenta ? parseFloat(formData.precioVenta) : undefined,
      costoPorUnidad: formData.costoPorUnidad ? parseFloat(formData.costoPorUnidad) : undefined,
      cantidad: parseInt(formData.cantidad) || 0,
      cantidadMinima: formData.cantidadMinima ? parseInt(formData.cantidadMinima) : undefined,
      cantidadMaxima: formData.cantidadMaxima ? parseInt(formData.cantidadMaxima) : undefined,
      tags: formData.tags ? formData.tags.split(',').map(tag => tag.trim()).filter(Boolean) : [],
    };

    onSave(dataToSave);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{product ? 'Editar Producto' : 'Nuevo Producto'}</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-row">
            <div className="form-group">
              <label>Nombre *</label>
              <input
                type="text"
                name="nombre"
                value={formData.nombre}
                onChange={handleChange}
                className={errors.nombre ? 'error' : ''}
              />
              {errors.nombre && <span className="error-text">{errors.nombre}</span>}
            </div>

            <div className="form-group">
              <label>SKU</label>
              <input
                type="text"
                name="sku"
                value={formData.sku}
                onChange={handleChange}
                placeholder="Código único del producto"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Descripción</label>
            <textarea
              name="descripcion"
              value={formData.descripcion}
              onChange={handleChange}
              rows="3"
              placeholder="Descripción detallada del producto"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Categoría</label>
              <input
                type="text"
                name="categoria"
                value={formData.categoria}
                onChange={handleChange}
                list="categorias"
                placeholder="Ej: Alimentos"
              />
              <datalist id="categorias">
                <option value="Alimentos" />
                <option value="Bebidas" />
                <option value="Postres" />
                <option value="Limpieza" />
                <option value="Utensilios" />
              </datalist>
            </div>

            <div className="form-group">
              <label>Subcategoría</label>
              <input
                type="text"
                name="subcategoria"
                value={formData.subcategoria}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Precio Unitario (Compra) </label>
              <input
                type="number"
                name="precioUnitario"
                value={formData.precioUnitario}
                onChange={handleChange}
                step="0.01"
                min="0"
              />
            </div>

            <div className="form-group">
              <label>Precio Venta</label>
              <input
                type="number"
                name="precioVenta"
                value={formData.precioVenta}
                onChange={handleChange}
                step="0.01"
                min="0"
              />
            </div>

            <div className="form-group">
              <label>Costo por Unidad</label>
              <input
                type="number"
                name="costoPorUnidad"
                value={formData.costoPorUnidad}
                onChange={handleChange}
                step="0.01"
                min="0"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Cantidad Inicial</label>
              <input
                type="number"
                name="cantidad"
                value={formData.cantidad}
                onChange={handleChange}
                min="0"
              />
            </div>

            <div className="form-group">
              <label>Cantidad Mínima (Alerta)</label>
              <input
                type="number"
                name="cantidadMinima"
                value={formData.cantidadMinima}
                onChange={handleChange}
                min="0"
                placeholder="Stock mínimo requerido"
              />
            </div>

            <div className="form-group">
              <label>Cantidad Máxima</label>
              <input
                type="number"
                name="cantidadMaxima"
                value={formData.cantidadMaxima}
                onChange={handleChange}
                min="0"
                placeholder="Stock máximo permitido"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Unidad</label>
              <select name="unidad" value={formData.unidad} onChange={handleChange}>
                <option value="Pieza">Pieza</option>
                <option value="Servicio">Servicio</option>
                <option value="Kilogramo">Kilogramo</option>
                <option value="Litro">Litro</option>
                <option value="Metro">Metro</option>
                <option value="Caja">Caja</option>
                <option value="Paquete">Paquete</option>
              </select>
            </div>

            <div className="form-group">
              <label>Clave Unidad (SAT)</label>
              <input
                type="text"
                name="claveUnidad"
                value={formData.claveUnidad}
                onChange={handleChange}
                placeholder="Ej: H87,E48, LTR"
                maxLength="3"
              />
            </div>

            <div className="form-group">
              <label>🔢 Clave Producto/Servicio (SAT) *</label>
              <input
                type="text"
                name="claveProdServ"
                value={formData.claveProdServ}
                onChange={handleChange}
                placeholder="Ej: 01010101, 50201501"
                maxLength="8"
                title="8 dígitos según catálogo SAT de productos y servicios"
              />
              <small style={{ color: '#666', marginTop: '4px', display: 'block' }}>
                8 dígitos del catálogo SAT. Ej: 50201501 (Comidas preparadas)
              </small>
            </div>
          </div>

          <div className="form-group">
            <label>Tags (separados por coma)</label>
            <input
              type="text"
              name="tags"
              value={formData.tags}
              onChange={handleChange}
              placeholder="Ej: orgánico, importado, promoción"
            />
          </div>

          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                name="activo"
                checked={formData.activo}
                onChange={handleChange}
              />
              <span>Producto activo</span>
            </label>
          </div>

          {product?._id && (
            <ProductImageUpload
              productId={product._id}
              imagenes={product.imagenes || []}
            />
          )}

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              {product ? 'Actualizar' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
