import { useState, useEffect } from 'react';
import { notesService } from '../services/notesService';
import { useToast } from './ui/Toast.jsx';

const formatDate = (s) => {
  if (!s) return 'N/A';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString('es-MX');
};

const formatDateTime = (s) => {
  if (!s) return 'N/A';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString('es-MX');
};

const methodLabel = (m) => {
  const map = {
    cash: 'Efectivo', transfer: 'Transferencia', card: 'Tarjeta',
    check: 'Cheque', deposit: 'Depósito', other: 'Otro',
  };
  return map[m] || m || '-';
};

/**
 * Modal de detalle de una nota: info general + lista de abonos.
 *
 * Props:
 *  - open: bool
 *  - onClose: fn()
 *  - note: objeto nota
 *  - onAddPayment: fn() → abre PaymentModal desde el padre
 *  - onChanged: fn() → recarga la lista
 */
export default function NoteDetailModal({ open, onClose, note, onAddPayment, onChanged }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [timbrando, setTimbrando] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (open && note?._id) {
      loadPayments();
    }
  }, [open, note?._id, note?.type]);

  const loadPayments = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await notesService.getPayments(note._id, note.type);
      setPayments(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Error al cargar abonos');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePayment = async (paymentId) => {
    if (!confirm('¿Eliminar este abono? El saldo pendiente se actualizará.')) return;
    setDeletingId(paymentId);
    try {
      await notesService.deletePayment(note._id, paymentId, note.type);
      toast.success('Abono eliminado');
      await loadPayments();
      if (onChanged) onChanged();
    } catch (err) {
      toast.error(err.message || 'Error al eliminar');
    } finally {
      setDeletingId(null);
    }
  };

  const handleTimbrarPPD = async () => {
    if (!confirm(
      `¿Timbrar CFDI PPD por $${Number(note.amount || 0).toFixed(2)}?\n\n` +
      `Esto consumirá un folio del PAC y no se puede deshacer.`
    )) return;
    setTimbrando(true);
    try {
      const { note: updated, invoice } = await notesService.timbrarPPD(note._id, { type: note.type });
      toast.success(`CFDI timbrado: ${updated.invoiceUuid}`);
      // refrescar padre para que la lista muestre el UUID
      if (onChanged) await onChanged();
      // actualizar la nota local para que el modal muestre el UUID
      Object.assign(note, updated);
      // forzar re-render: recargar pagos
      await loadPayments();
    } catch (err) {
      toast.error(err.message || 'Error al timbrar CFDI');
    } finally {
      setTimbrando(false);
    }
  };

  if (!open || !note) return null;

  const balance = Number(note.balance ?? (note.amount - (note.paidAmount || 0))) || 0;
  const statusClass = note.status || 'pending';
  const statusLabel = {
    pending: 'Pendiente', partial: 'Parcial', paid: 'Pagada', cancelled: 'Cancelada',
  }[statusClass] || statusClass;

  return (
    <div className="notes-modal-backdrop" onClick={onClose}>
      <div className="notes-modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="notes-modal-header">
          <h3>Detalle de Nota</h3>
          <button type="button" className="notes-modal-close" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            {note.folio && (
              <div style={{
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                color: 'var(--gray-500, #6b7280)',
                marginBottom: '0.15rem',
                letterSpacing: '0.5px',
              }}>
                Folio: <strong style={{ color: 'var(--gray-700, #374151)' }}>{note.folio}</strong>
              </div>
            )}
            <div style={{ fontSize: '0.8rem', color: 'var(--gray-500, #6b7280)' }}>Concepto</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{note.concept}</div>
            {note.reference && <div style={{ fontSize: '0.8rem', color: 'var(--gray-500, #6b7280)' }}>Ref: {note.reference}</div>}
            {note.invoiceUuid && (
              <div style={{ fontSize: '0.75rem', color: 'var(--gray-500, #6b7280)', marginTop: '0.2rem' }}>
                CFDI: <span style={{ fontFamily: 'monospace' }}>{note.invoiceUuid}</span>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {note.type === 'receivable' && !note.invoiceUuid && note.status !== 'cancelled' && note.status !== 'paid' && (
              <button
                type="button"
                className="btn"
                style={{
                  fontSize: '0.78rem',
                  padding: '0.4rem 0.75rem',
                  background: '#2563eb',
                  color: 'white',
                  border: 'none',
                  cursor: timbrando ? 'wait' : 'pointer',
                  opacity: timbrando ? 0.7 : 1,
                }}
                onClick={handleTimbrarPPD}
                disabled={timbrando}
                title="Genera un CFDI 4.0 PPD (Pago en Parcialidades o Diferido) vinculado a esta nota y lo liga al UUID"
              >
                {timbrando ? '⏳ Timbrando…' : '🧾 Timbrar CFDI PPD'}
              </button>
            )}
            <span className={`notes-badge ${statusClass}`}>{statusLabel}</span>
          </div>
        </div>

        <div className="notes-detail-grid">
          <div>
            <div className="field-label">Contacto</div>
            <div className="field-value">{note.contactName || '-'}</div>
            {note.contactRfc && <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>{note.contactRfc}</div>}
          </div>
          <div>
            <div className="field-label">Fechas</div>
            <div className="field-value" style={{ fontSize: '0.9rem' }}>
              Emisión: {formatDate(note.issueDate)}<br />
              Vence: {formatDate(note.dueDate)}
            </div>
          </div>
          <div>
            <div className="field-label">Monto original</div>
            <div className="field-value">${Number(note.amount || 0).toFixed(2)}</div>
          </div>
          <div>
            <div className="field-label">Abonado</div>
            <div className="field-value" style={{ color: '#10b981' }}>
              ${Number(note.paidAmount || 0).toFixed(2)}
            </div>
          </div>
          <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--gray-200, #e5e7eb)', paddingTop: '0.75rem' }}>
            <div className="field-label">Saldo pendiente</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: balance > 0 ? '#ef4444' : '#10b981' }}>
              ${balance.toFixed(2)}
            </div>
          </div>
          {note.notes && (
            <div style={{ gridColumn: '1 / -1' }}>
              <div className="field-label">Notas</div>
              <div className="field-value" style={{ fontSize: '0.9rem' }}>{note.notes}</div>
            </div>
          )}
        </div>

        <div className="notes-payments-list">
          <div className="notes-payments-list-header">
            <span>Abonos ({payments.length})</span>
            {note.status !== 'paid' && note.status !== 'cancelled' && onAddPayment && (
              <button
                type="button"
                className="btn btn-primary"
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                onClick={onAddPayment}
              >
                + Registrar abono
              </button>
            )}
          </div>

          {error && (
            <div style={{ padding: '0.75rem 1rem', color: '#991b1b', background: '#fee2e2', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          {loading ? (
            <div className="empty">Cargando abonos...</div>
          ) : payments.length === 0 ? (
            <div className="empty">No hay abonos registrados</div>
          ) : (
            <div className="notes-payments-list-wrapper">
              <table>
              <thead>
                <tr style={{ background: 'var(--gray-50, #f9fafb)' }}>
                  <th>Fecha</th>
                  <th>Forma de pago</th>
                  <th>Referencia</th>
                  <th style={{ textAlign: 'right' }}>Monto</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p._id}>
                    <td>{formatDateTime(p.date || p.createdAt)}</td>
                    <td>{methodLabel(p.method)}</td>
                    <td>{p.reference || '-'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      ${Number(p.amount || 0).toFixed(2)}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-sm"
                        style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', color: '#dc2626' }}
                        onClick={() => handleDeletePayment(p._id)}
                        disabled={deletingId === p._id}
                      >
                        {deletingId === p._id ? '...' : '🗑'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}

          {payments.length > 0 && (
            <div className="notes-payments-total">
              <span>Total abonado</span>
              <span>${payments.reduce((s, p) => s + Number(p.amount || 0), 0).toFixed(2)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
