import { useState, useEffect } from 'react';

const PAYMENT_METHODS = [
  { value: 'cash',        label: 'Efectivo' },
  { value: 'transfer',    label: 'Transferencia' },
  { value: 'card',        label: 'Tarjeta' },
  { value: 'check',       label: 'Cheque' },
  { value: 'deposit',     label: 'Depósito' },
  { value: 'other',       label: 'Otro' },
];

const todayISO = () => new Date().toISOString().split('T')[0];

/**
 * Modal para registrar un abono / pago a una nota.
 *
 * Props:
 *  - open: bool
 *  - onClose: fn()
 *  - onSave: async (data) => void
 *  - note: nota a la que se abona (con balance y amount)
 */
export default function PaymentModal({ open, onClose, onSave, note }) {
  const balance = Number(note?.balance ?? (note?.amount - (note?.paidAmount || 0))) || 0;
  const [form, setForm] = useState({
    amount: balance.toFixed(2),
    method: 'cash',
    date: todayISO(),
    reference: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open && note) {
      const bal = Number(note.balance ?? (note.amount - (note.paidAmount || 0))) || 0;
      setForm({
        amount: bal.toFixed(2),
        method: 'cash',
        date: todayISO(),
        reference: '',
        notes: '',
      });
      setError(null);
    }
  }, [open, note]);

  if (!open || !note) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const setQuickAmount = (factor) => {
    setForm(prev => ({ ...prev, amount: (balance * factor).toFixed(2) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('El monto del abono debe ser mayor a 0');
      return;
    }
    if (amount > balance + 0.01) {
      setError(`El abono no puede ser mayor al saldo pendiente ($${balance.toFixed(2)})`);
      return;
    }

    setSaving(true);
    try {
      await onSave({
        amount,
        method: form.method,
        date: form.date,
        reference: form.reference.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Error al registrar el abono');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="notes-modal-backdrop" onClick={onClose}>
      <div className="notes-modal" onClick={(e) => e.stopPropagation()}>
        <div className="notes-modal-header">
          <h3>Registrar Abono</h3>
          <button type="button" className="notes-modal-close" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <div style={{ background: 'var(--blue-50, #eff6ff)', padding: '0.85rem 1rem', borderRadius: 6, marginBottom: '1rem', fontSize: '0.9rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
            <span>Contacto:</span>
            <strong>{note.contactName}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
            <span>Concepto:</span>
            <span>{note.concept}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
            <span>Monto original:</span>
            <span>${Number(note.amount || 0).toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
            <span>Abonado:</span>
            <span>${Number(note.paidAmount || 0).toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--gray-300, #d1d5db)', paddingTop: '0.4rem', marginTop: '0.4rem' }}>
            <strong>Saldo pendiente:</strong>
            <strong style={{ color: '#ef4444' }}>${balance.toFixed(2)}</strong>
          </div>
        </div>

        {error && (
          <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.6rem 0.85rem', borderRadius: 6, marginBottom: '1rem', fontSize: '0.9rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="notes-form-row">
            <div className="form-group">
              <label>Monto del abono *</label>
              <input
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                max={balance}
                value={form.amount}
                onChange={handleChange}
                required
              />
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem' }}>
                <button type="button" className="btn" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }} onClick={() => setQuickAmount(0.25)}>25%</button>
                <button type="button" className="btn" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }} onClick={() => setQuickAmount(0.5)}>50%</button>
                <button type="button" className="btn" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }} onClick={() => setQuickAmount(0.75)}>75%</button>
                <button type="button" className="btn" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }} onClick={() => setQuickAmount(1)}>100%</button>
              </div>
            </div>
            <div className="form-group">
              <label>Forma de pago *</label>
              <select name="method" value={form.method} onChange={handleChange}>
                {PAYMENT_METHODS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="notes-form-row">
            <div className="form-group">
              <label>Fecha *</label>
              <input
                name="date"
                type="date"
                value={form.date}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Referencia</label>
              <input
                name="reference"
                value={form.reference}
                onChange={handleChange}
                placeholder="Folio transferencia, cheque, etc."
              />
            </div>
          </div>

          <div className="notes-form-row full">
            <div className="form-group">
              <label>Notas</label>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                rows="2"
                placeholder="Comentarios del abono (opcional)"
              />
            </div>
          </div>

          <div className="notes-form-actions">
            <button type="button" className="btn" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Registrando...' : 'Registrar Abono'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
