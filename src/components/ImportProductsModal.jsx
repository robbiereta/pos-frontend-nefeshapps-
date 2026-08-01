import { useState, useRef } from 'react';
import { productService } from '../services/productService';
import { useToast } from './ui/Toast.jsx';
import './Modal.css';
import './ImportProductsModal.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5002';

const TEMPLATE_COLUMNS = [
  'nombre', 'descripcion', 'sku', 'claveProdServ',
  'precioUnitario', 'precioVenta', 'costoPorUnidad',
  'unidad', 'claveUnidad',
  'cantidad', 'cantidadMinima', 'cantidadMaxima',
  'categoria', 'subcategoria', 'tags',
  'objetoImp', 'tasaIVA', 'tasaISR',
  'activo', 'notas',
  'proveedor_nombre', 'proveedor_contacto', 'proveedor_email', 'proveedor_telefono',
];

export default function ImportProductsModal({ onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [skipValidation, setSkipValidation] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);
  const toast = useToast();

  const handleSelect = (f) => {
    if (!f) return;
    if (!/\.(xlsx|xls|csv)$/i.test(f.name)) {
      toast?.error?.('Solo se permiten archivos .xlsx, .xls o .csv');
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast?.error?.('El archivo supera 5MB');
      return;
    }
    setFile(f);
    setResult(null);
  };

  const handleSubmit = async () => {
    if (!file) {
      toast?.error?.('Selecciona un archivo');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const qs = skipValidation ? '?skipValidation=true' : '';
      const res = await fetch(`${API_URL}/api/products/upload-excel${qs}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || data.error || `Error ${res.status}`);
      }
      setResult(data);
      toast?.success?.(`Importación completada: ${data.inserted || data.created?.length || 0} productos`);
      onSuccess?.(data);
    } catch (err) {
      toast?.error?.(err.message);
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = () => {
    // CSV simple con encabezados para que el usuario lo llene
    const sample = TEMPLATE_COLUMNS.join(',') + '\n' +
      'Coca Cola 600ml,Refresco de cola,COK600,50202201,18.50,22,,Pieza,H87,100,10,500,Bebidas,Refrescos,cola;gaseosa,02,0.16,0,true,Proveedor oficial,,,\n';
    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla_productos.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const errors = result?.errors || [];
  const inserted = result?.inserted ?? result?.created?.length ?? result?.summary?.inserted ?? 0;
  const updated = result?.updated ?? result?.summary?.updated ?? 0;
  const skipped = result?.skipped ?? result?.summary?.skipped ?? 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content import-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📥 Importar productos desde Excel/CSV</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <p className="import-hint">
            Sube un archivo <code>.xlsx</code>, <code>.xls</code> o <code>.csv</code> con las columnas del modelo de producto (ver plantilla).
            Máximo 5MB.
          </p>

          <div className="import-actions-row">
            <button type="button" className="btn btn-secondary" onClick={downloadTemplate}>
              📄 Descargar plantilla
            </button>
          </div>

          <div
            className={`import-dropzone ${dragOver ? 'is-over' : ''} ${file ? 'has-file' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleSelect(e.dataTransfer.files?.[0]); }}
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              hidden
              onChange={(e) => handleSelect(e.target.files?.[0])}
            />
            {file ? (
              <div>
                <strong>📎 {file.name}</strong>
                <div className="muted">{(file.size / 1024).toFixed(1)} KB — click para cambiar</div>
              </div>
            ) : (
              <div>📂 Arrastra tu archivo aquí o haz click para seleccionar</div>
            )}
          </div>

          <label className="import-check">
            <input
              type="checkbox"
              checked={skipValidation}
              onChange={(e) => setSkipValidation(e.target.checked)}
            />
            <span>Saltar validación (no recomendado)</span>
          </label>

          {result && (
            <div className={`import-result ${errors.length ? 'has-errors' : 'ok'}`}>
              <h3>Resultado</h3>
              <ul className="import-stats">
                <li>✅ Insertados: <strong>{inserted}</strong></li>
                <li>🔄 Actualizados: <strong>{updated}</strong></li>
                <li>⏭️ Omitidos: <strong>{skipped}</strong></li>
                <li>❌ Errores: <strong>{errors.length}</strong></li>
              </ul>
              {errors.length > 0 && (
                <details className="import-errors" open>
                  <summary>Ver errores ({errors.length})</summary>
                  <ul>
                    {errors.slice(0, 50).map((e, i) => (
                      <li key={i}>{typeof e === 'string' ? e : (e.message || JSON.stringify(e))}</li>
                    ))}
                    {errors.length > 50 && <li>… y {errors.length - 50} más</li>}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cerrar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={!file || uploading}
          >
            {uploading ? 'Importando…' : 'Importar'}
          </button>
        </div>
      </div>
    </div>
  );
}
