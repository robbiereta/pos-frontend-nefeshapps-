import { useState, useRef } from 'react';
import {
  uploadProductImages,
  deleteProductImage,
  setPrincipalImage,
  getProductImageUrl,
} from '../services/productImageService';
import { useToast } from './ui/Toast.jsx';
import './ProductImageUpload.css';

/**
 * Gestor de imágenes de un producto.
 *
 * Props:
 *   - productId: id del producto
 *   - imagenes:  array actual [{ _id, url, principal, ... }]
 *   - onChange:  callback(newImagenes) cuando cambia el array
 */
export default function ProductImageUpload({ productId, imagenes = [], onChange }) {
  const [list, setList] = useState(imagenes);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);
  const toast = useToast();

  const sync = (next) => {
    setList(next);
    onChange?.(next);
  };

  const handleFiles = async (fileList) => {
    if (!productId) {
      toast?.error?.('Guarda el producto primero para poder subir imágenes');
      return;
    }
    const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) {
      toast?.error?.('Solo se permiten imágenes (jpg, png, webp, gif)');
      return;
    }
    if (files.length > 8) {
      toast?.error?.('Máximo 8 imágenes a la vez');
      return;
    }
    setUploading(true);
    try {
      const { imagenes: next } = await uploadProductImages(productId, files, {
        principal: list.length === 0, // primera carga => principal
      });
      sync(next);
      toast?.success?.(`${files.length} imagen(es) subida(s)`);
    } catch (err) {
      toast?.error?.(err.message || 'Error al subir');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (imgId) => {
    if (!window.confirm('¿Eliminar esta imagen?')) return;
    try {
      const { imagenes: next } = await deleteProductImage(productId, imgId);
      sync(next);
      toast?.success?.('Imagen eliminada');
    } catch (err) {
      toast?.error?.(err.message || 'Error al eliminar');
    }
  };

  const handlePrincipal = async (imgId) => {
    try {
      const { imagenes: next } = await setPrincipalImage(productId, imgId);
      sync(next);
    } catch (err) {
      toast?.error?.(err.message || 'Error');
    }
  };

  return (
    <div className="piu-root">
      <label className="piu-label">Imágenes del producto</label>

      <div
        className={`piu-dropzone ${dragOver ? 'is-over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
        {uploading ? (
          <span>Subiendo…</span>
        ) : (
          <span>📷 Arrastra imágenes aquí o haz click para seleccionar (máx. 8, 5MB c/u)</span>
        )}
      </div>

      {list.length > 0 && (
        <ul className="piu-grid">
          {list.map((img) => (
            <li
              key={img._id || img.url}
              className={`piu-item ${img.principal ? 'is-principal' : ''}`}
            >
              <img src={getProductImageUrl(img.url)} alt="" />
              <div className="piu-actions">
                {!img.principal && (
                  <button
                    type="button"
                    className="piu-btn piu-btn-ghost"
                    onClick={() => handlePrincipal(img._id)}
                    title="Marcar como principal"
                  >
                    ★ Principal
                  </button>
                )}
                {img.principal && <span className="piu-badge">Principal</span>}
                <button
                  type="button"
                  className="piu-btn piu-btn-danger"
                  onClick={() => handleDelete(img._id)}
                  title="Eliminar"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
