import { useState, useEffect } from 'react';

const todayISO = () => new Date().toISOString().split('T')[0];
const addDays = (iso, days) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

const emptyForm = () => ({
  contactName: '',
  contactRfc: '',
  reference: '',
  concept: '',
  amount: '',
  issueDate: todayISO(),
  dueDate: addDays(todayISO(), 30),
  notes: '',
});

/**
 * Modal para crear / editar una nota (por cobrar o por pagar).
 *
 * Props:
 *  - open: bool
 *  - onClose: fn()
 *  - onSave: async (data) => void
 *  - initial: nota a editar (opcional)
 *  - type: 'receivable' | 'payable'
 */
export default function NoteModal({ open, onClose, onSave, initial, type }) {
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      if (initial) {
        setForm({
          contactName: initial.contactName || '',
          contactRfc: initial.contactRfc || '',
          reference: initial.reference || '',
          concept: initial.concept || '',
          amount: initial.amount ?? '',
          issueDate: initial.issueDate?.split('T')[0] || todayISO(),
          dueDate: initial.dueDate?.split('T')[0] || addDays(todayISO(), 30),
          notes: initial.notes || '',
        });
      } else {
        setForm(emptyForm());
      }
      setError(null);
    }
  }, [open, initial]);

  if (!open) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!form.contactName.trim()) {
      setError('El nombre del contacto es obligatorio');
      return;
    }
    if (!form.concept.trim()) {
      setError('El concepto es obligatorio');
      return;
    }
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('El monto debe ser mayor a 0');
      return;
    }
    if (!form.issueDate || !form.dueDate) {
      setError('Las fechas son obligatorias');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        type,
        contactName: form.contactName.trim(),
        contactRfc: form.contactRfc.trim() || undefined,
        reference: form.reference.trim() || undefined,
        concept: form.concept.trim(),
        amount,
        issueDate: form.issueDate,
        dueDate: form.dueDate,
        notes: form.notes.trim() || undefined,
      };
      await onSave(payload);
      onClose();
    } catch (err) {
      setError(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const title = initial
    ? (type === 'receivable' ? 'Editar Nota por Cobrar' : 'Editar Nota por Pagar')
    : (type === 'receivable' ? 'Nueva Nota por Cobrar' : 'Nueva Nota por Pagar');

  return (
    <div className="notes-modal-backdrop" onClick={onClose}>
      <div className="notes-modal" onClick={(e) => e.stopPropagation()}>
        <div className="notes-modal-header">
          <h3>{title}</h3>
          <button type="button" className="notes-modal-close" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        {error && (
          <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.6rem 0.85rem', borderRadius: 6, marginBottom: '1rem', fontSize: '0.9rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="notes-form-row">
            <div className="form-group">
              <label>{type === 'receivable' ? 'Cliente *' : 'Proveedor *'}</label>
              <input
                name="contactName"
                value={form.contactName}
                onChange={handleChange}
                placeholder="Nombre o razón social"
                required
              />
            </div>
            <div className="form-group">
              <label>RFC</label>
              <input
                name="contactRfc"
                value={form.contactRfc}
                onChange={handleChange}
                placeholder="XAXX010101000"
                maxLength={13}
              />
            </div>
          </div>

          <div className="notes-form-row">
            <div className="form-group">
              <label>Referencia / Folio</label>
              <input
                name="reference"
                value={form.reference}
                onChange={handleChange}
                placeholder="FACT-123, orden de compra, etc."
              />
            </div>
            <div className="form-group">
              <label>Monto *</label>
              <input
                name="amount"
                type="number"
                step="0.01"
                min="0"
                value={form.amount}
                onChange={handleChange}
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div className="notes-form-row full">
            <div className="form-group">
              <label>Concepto *</label>
              <input
                name="concept"
                value={form.concept}
                onChange={handleChange}
                placeholder="Descripción de la nota"
                required
              />
            </div>
          </div>

          <div className="notes-form-row">
            <div className="form-group">
              <label>Fecha de emisión *</label>
              <input
                name="issueDate"
                type="date"
                value={form.issueDate}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Fecha de vencimiento *</label>
              <input
                name="dueDate"
                type="date"
                value={form.dueDate}
                onChange={handleChange}
                required
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
                placeholder="Comentarios adicionales (opcional)"
              />
            </div>
          </div>

          <div className="notes-form-actions">
            <button type="button" className="btn" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : (initial ? 'Actualizar' : 'Crear')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
