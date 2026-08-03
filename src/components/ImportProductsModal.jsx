import { useState, useRef } from 'react';
import { productService } from '../services/productService';
import { useToast } from './ui/Toast.jsx';
import './Modal.css';
import './ImportProductsModal.css';

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

// CSV row helper: escape a field if it contains comma, quote, or newline.
const csvField = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const SAMPLE_ROW = [
  'Coca Cola 600ml', 'Refresco de cola', 'COK600', '50202201',
  18.5, 22, 10, 'Pieza', 'H87',
  100, 10, 500, 'Bebidas', 'Refrescos', 'cola;gaseosa',
  '02', 0.16, 0, true, 'Línea de prueba',
  'Proveedor oficial', '', '', '',
];

export default function ImportProductsModal({ onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [skipValidation, setSkipValidation] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [errorList, setErrorList] = useState([]);
  const [errorMessage, setErrorMessage] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);
  const toast = useToast();

  const reset = () => {
    setResult(null);
    setErrorList([]);
    setErrorMessage(null);
  };

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
    reset();
  };

  const handleSubmit = async () => {
    if (!file) {
      toast?.error?.('Selecciona un archivo');
      return;
    }
    setUploading(true);
    reset();
    try {
      const data = await productService.uploadExcel(file, { skipValidation });
      // Backend success shape:
      //   { success: true, message, data: { uploaded, failed, products:[{nombre,id,row}], errors? } }
      const inner = data?.data || {};
      const uploaded = inner.uploaded ?? inner.products?.length ?? 0;
      const failed = inner.failed ?? 0;
      const list = Array.isArray(inner.errors) ? inner.errors : [];
      setResult({ uploaded, failed, products: inner.products || [], errors: list });
      toast?.success?.(
        failed > 0
          ? `Importación parcial: ${uploaded} OK, ${failed} con error`
          : `Importación completada: ${uploaded} productos`
      );
      onSuccess?.(data);
    } catch (err) {
      // Validation error: 400 with { success:false, message, details:[strings] }
      if (err.details?.length) {
        setErrorList(err.details);
        setErrorMessage(err.message);
        toast?.error?.(`${err.message} (${err.details.length} errores)`);
      } else {
        setErrorMessage(err.message);
        toast?.error?.(err.message);
      }
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = () => {
    const csv =
      TEMPLATE_COLUMNS.join(',') + '\n' +
      SAMPLE_ROW.map(csvField).join(',') + '\n';
    // BOM so Excel detects UTF-8 correctly
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla_productos.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content import-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📥 Importar productos desde Excel/CSV</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <p className="import-hint">
            Sube un archivo <code>.xlsx</code>, <code>.xls</code> o <code>.csv</code> con las columnas
            del modelo de producto (ver plantilla). Máximo 5MB.
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
            <div className={`import-result ${result.failed > 0 ? 'has-errors' : 'ok'}`}>
              <h3>Resultado</h3>
              <ul className="import-stats">
                <li>✅ Insertados: <strong>{result.uploaded}</strong></li>
                <li>❌ Fallidos: <strong>{result.failed}</strong></li>
              </ul>
              {result.products?.length > 0 && (
                <details className="import-errors" open>
                  <summary>Productos creados ({result.products.length})</summary>
                  <ul>
                    {result.products.slice(0, 50).map((p) => (
                      <li key={p.id}>
                        Fila {p.row}: <strong>{p.nombre}</strong>
                        <span className="muted"> · {String(p.id).slice(-8)}</span>
                      </li>
                    ))}
                    {result.products.length > 50 && (
                      <li>… y {result.products.length - 50} más</li>
                    )}
                  </ul>
                </details>
              )}
              {result.errors?.length > 0 && (
                <details className="import-errors" open>
                  <summary>Errores por fila ({result.errors.length})</summary>
                  <ul>
                    {result.errors.slice(0, 50).map((e, i) => (
                      <li key={i}>
                        Fila {e.row} {e.nombre ? `· ${e.nombre}` : ''}: {e.error}
                      </li>
                    ))}
                    {result.errors.length > 50 && (
                      <li>… y {result.errors.length - 50} más</li>
                    )}
                  </ul>
                </details>
              )}
            </div>
          )}

          {errorMessage && !result && (
            <div className="import-result has-errors">
              <h3>❌ {errorMessage}</h3>
              {errorList.length > 0 && (
                <details className="import-errors" open>
                  <summary>Detalle ({errorList.length})</summary>
                  <ul>
                    {errorList.map((e, i) => <li key={i}>{e}</li>)}
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
