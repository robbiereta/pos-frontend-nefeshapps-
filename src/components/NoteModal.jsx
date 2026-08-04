import { useState, useEffect, useMemo } from 'react';
import { clientService } from '../services/api';

const todayISO = () => new Date().toISOString().split('T')[0];
const addDays = (iso, days) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

const emptyForm = () => ({
  clienteId: '',
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
  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [clientSearch, setClientSearch] = useState('');

  useEffect(() => {
    if (open) {
      if (initial) {
        setForm({
          clienteId: initial.clienteId || '',
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
      setClientSearch('');
    }
  }, [open, initial]);

  // Cargar clientes al abrir (solo para CxC; las CxP no usan esta lógica)
  useEffect(() => {
    if (!open || type !== 'receivable') return;
    let cancelled = false;
    (async () => {
      setLoadingClients(true);
      try {
        const res = await clientService.getAllClients({ limit: 500, page: 1 });
        if (!cancelled) setClients(res.data || []);
      } catch (e) {
        // No es fatal: el usuario puede capturar manualmente
        if (!cancelled) setClients([]);
      } finally {
        if (!cancelled) setLoadingClients(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, type]);

  if (!open) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  // Cambia el cliente seleccionado: autollena nombre y RFC
  const handleClientPick = (e) => {
    const value = e.target.value;
    if (value === '__free__') {
      setForm(prev => ({ ...prev, clienteId: '', contactName: '', contactRfc: '' }));
    } else if (value === '') {
      setForm(prev => ({ ...prev, clienteId: '' }));
    } else {
      const c = clients.find(x => x._id === value);
      if (c) {
        setForm(prev => ({
          ...prev,
          clienteId: c._id,
          contactName: c.nombre || '',
          contactRfc: c.rfc || '',
        }));
      }
    }
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
        clienteId: form.clienteId || undefined,
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

  // Lista filtrada por la búsqueda del usuario
  const filteredClients = useMemo(() => {
    if (!clientSearch) return clients.slice(0, 100);
    const q = clientSearch.toLowerCase();
    return clients
      .filter(c =>
        (c.nombre || '').toLowerCase().includes(q) ||
        (c.rfc || '').toLowerCase().includes(q)
      )
      .slice(0, 100);
  }, [clients, clientSearch]);

  // Helper: si hay cliente seleccionado, mostrar su info
  const selectedClient = form.clienteId
    ? clients.find(c => c._id === form.clienteId)
    : null;

  return (
    <div className="notes-modal-backdrop" onClick={onClose}>
      <div className="notes-modal" onClick={(e) => e.stopPropagation()}>
        <div className="notes-modal-header">
          <h3>{title}</h3>
          <button type="button" className="notes-modal-close" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        {error && (
          <div style={{ background: 'linear-gradient(to right, #fee2e2, #fecaca)', color: '#991b1b', padding: '0.85rem 1rem', borderRadius: 8, marginBottom: '1.25rem', fontSize: '0.9rem', border: '1px solid #fca5a5', fontWeight: 500 }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Picker de cliente (solo CxC) */}
          {type === 'receivable' && (
            <div className="notes-form-row full">
              <div className="form-group">
                <label>{initial ? 'Cliente' : 'Cliente (catálogo)'} </label>
                {loadingClients ? (
                  <div style={{ padding: '0.5rem 0', color: 'var(--gray-500)', fontSize: '0.85rem' }}>
                    Cargando clientes...
                  </div>
                ) : clients.length > 0 ? (
                  <>
                    <input
                      type="text"
                      placeholder="🔍 Buscar por nombre o RFC..."
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      style={{ marginBottom: '0.4rem' }}
                    />
                    <select
                      value={form.clienteId || (initial ? '' : '__free__')}
                      onChange={handleClientPick}
                    >
                      {!initial && <option value="__free__">— Texto libre (sin cliente del catálogo) —</option>}
                      {initial && !selectedClient && <option value="">— Sin cliente —</option>}
                      {filteredClients.map(c => (
                        <option key={c._id} value={c._id}>
                          {c.nombre} {c.rfc ? `(${c.rfc})` : ''}
                        </option>
                      ))}
                    </select>
                  </>
                ) : (
                  <div style={{ padding: '0.4rem 0', color: 'var(--gray-500)', fontSize: '0.85rem' }}>
                    Sin clientes en el catálogo. Captura los datos abajo.
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="notes-form-row">
            <div className="form-group">
              <label>{type === 'receivable' ? 'Cliente *' : 'Proveedor *'}</label>
              <input
                name="contactName"
                value={form.contactName}
                onChange={handleChange}
                placeholder="Nombre o razón social"
                readOnly={!!selectedClient}
                style={selectedClient ? { background: 'var(--gray-100, #f3f4f6)' } : undefined}
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
                readOnly={!!selectedClient}
                style={selectedClient ? { background: 'var(--gray-100, #f3f4f6)' } : undefined}
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
                placeholder={initial?.folio ? `Folio actual: ${initial.folio}` : 'FACT-123, orden de compra, etc.'}
              />
              {initial?.folio && (
                <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)', marginTop: '0.2rem' }}>
                  Folio generado por el sistema: <strong>{initial.folio}</strong> (no editable)
                </div>
              )}
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
