import React, { useState, useRef, useEffect, useCallback } from 'react';
import { productService } from '../services/productService';
import './BarcodeSearch.css';

/**
 * Barcode / SKU search input.
 *
 * Works with USB barcode scanners (which type a code then send "Enter")
 * and with manual typing. On Enter or "Buscar", calls onProductFound
 * with the resolved product, or shows an inline error if not found.
 *
 * Falls back to a local in-memory filter on the provided `localProducts`
 * list if the API doesn't have a dedicated barcode endpoint, so it stays
 * functional even when offline / using the default catalog.
 */
export default function BarcodeSearch({ localProducts = [], onProductFound, onError, autoFocus = true }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const inputRef = useRef(null);
  const successTimer = useRef(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => () => clearTimeout(successTimer.current), []);

  const flashSuccess = (msg) => {
    setSuccess(msg);
    setError(null);
    clearTimeout(successTimer.current);
    successTimer.current = setTimeout(() => setSuccess(null), 1800);
  };

  const flashError = (msg) => {
    setError(msg);
    setSuccess(null);
    clearTimeout(successTimer.current);
    successTimer.current = setTimeout(() => setError(null), 2500);
  };

  const resolveLocally = useCallback((needle) => {
    const n = needle.trim().toLowerCase();
    if (!n) return null;
    return (
      localProducts.find(
        (p) => (p.sku || '').toLowerCase() === n,
      ) ||
      localProducts.find(
        (p) =>
          (p.sku || '').toLowerCase().includes(n) ||
          (p.nombre || '').toLowerCase().includes(n) ||
          (p.descripcion || '').toLowerCase().includes(n),
      ) ||
      null
    );
  }, [localProducts]);

  const handleSearch = useCallback(async (raw) => {
    const needle = (raw ?? code).trim();
    if (!needle) return;
    setLoading(true);
    setError(null);
    try {
      let product = null;
      // Try the API first
      try {
        const res = await productService.getProductBySku(needle);
        product = res?.data || res;
      } catch (_) {
        // API miss — fall through to local lookup
      }
      // Fallback: local catalog
      if (!product) product = resolveLocally(needle);

      if (!product) {
        const msg = `No se encontró producto con código "${needle}"`;
        flashError(msg);
        onError?.(msg);
        return;
      }
      onProductFound?.(product);
      flashSuccess(`✓ ${product.nombre || product.descripcion}`);
      setCode('');
      // Re-focus so the next scan lands here immediately
      inputRef.current?.focus();
    } catch (err) {
      flashError(err.message || 'Error al buscar');
    } finally {
      setLoading(false);
    }
  }, [code, onProductFound, resolveLocally]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    } else if (e.key === 'Escape') {
      setCode('');
      setError(null);
      setSuccess(null);
    }
  };

  return (
    <div className={`barcode-search ${error ? 'has-error' : ''} ${success ? 'has-success' : ''}`}>
      <div className="barcode-search__field">
        <span className="barcode-search__icon" aria-hidden>📷</span>
        <input
          ref={inputRef}
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          className="barcode-search__input"
          placeholder="Escanea código de barras o escribe SKU…"
          value={code}
          onChange={(e) => { setCode(e.target.value); if (error) setError(null); }}
          onKeyDown={handleKeyDown}
          aria-label="Buscar por código de barras o SKU"
        />
        <button
          type="button"
          className="barcode-search__btn"
          onClick={() => handleSearch()}
          disabled={loading || !code.trim()}
        >
          {loading ? '…' : 'Buscar'}
        </button>
      </div>
      {error && <div className="barcode-search__msg barcode-search__msg--error">{error}</div>}
      {success && <div className="barcode-search__msg barcode-search__msg--success">{success}</div>}
    </div>
  );
}
