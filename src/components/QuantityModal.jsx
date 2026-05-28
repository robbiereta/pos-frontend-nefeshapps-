import { useState } from 'react';
import './Modal.css';

export default function QuantityModal({ product, onClose, onSave }) {
  const [operation, setOperation] = useState('set');
  const [valor, setValor] = useState('');
  const [error, setError] = useState('');

  const calculateNewQuantity = () => {
    const currentQuantity = product.cantidad || 0;
    const amount = parseInt(valor) || 0;

    switch (operation) {
      case 'increase':
        return currentQuantity + amount;
      case 'decrease':
        return Math.max(0, currentQuantity - amount);
      case 'set':
        return amount;
      default:
        return currentQuantity;
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!valor || parseInt(valor) < 0) {
      setError('Ingrese un valor válido mayor o igual a 0');
      return;
    }

    const newQuantity = calculateNewQuantity();

    if (operation === 'decrease' && newQuantity < 0) {
      setError('La cantidad no puede ser negativa');
      return;
    }

    onSave(operation, parseInt(valor));
  };

  const operationLabels = {
    increase: 'Aumentar',
    decrease: 'Disminuir',
    set: 'Establecer',
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-small" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Ajustar Cantidad</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="product-info">
          <strong>{product.nombre}</strong>
          <div className="current-stock">
            Stock actual: <span className="stock-value">{product.cantidad || 0} {product.unidad}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Operación</label>
            <div className="operation-buttons">
              <button
                type="button"
                className={`operation-btn ${operation === 'increase' ? 'active' : ''}`}
                onClick={() => setOperation('increase')}
              >
                ➕ Aumentar
              </button>
              <button
                type="button"
                className={`operation-btn ${operation === 'decrease' ? 'active' : ''}`}
                onClick={() => setOperation('decrease')}
              >
                ➖ Disminuir
              </button>
              <button
                type="button"
                className={`operation-btn ${operation === 'set' ? 'active' : ''}`}
                onClick={() => setOperation('set')}
              >
                🔢 Establecer
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>Cantidad</label>
            <input
              type="number"
              value={valor}
              onChange={(e) => {
                setValor(e.target.value);
                setError('');
              }}
              min="0"
              placeholder="Ingrese la cantidad"
              autoFocus
              className={error ? 'error' : ''}
            />
            {error && <span className="error-text">{error}</span>}
          </div>

          {valor && (
            <div className="quantity-preview">
              <div className="preview-label">Cantidad resultante:</div>
              <div className="preview-value">
                {product.cantidad || 0}
                {operation === 'increase' && ` + ${valor}`}
                {operation === 'decrease' && ` - ${valor}`}
                {operation === 'set' && ` → ${valor}`}
                <span className="preview-result"> = {calculateNewQuantity()}</span>
              </div>
            </div>
          )}

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              {operationLabels[operation]}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
