import { useState, useEffect, useMemo } from 'react';
import { notesService, computeAgingClient } from '../services/notesService';
import { useToast } from './ui/Toast.jsx';
import NoteModal from './NoteModal.jsx';
import PaymentModal from './PaymentModal.jsx';
import NoteDetailModal from './NoteDetailModal.jsx';
import AgingReport from './AgingReport.jsx';

const formatDate = (s) => {
  if (!s) return 'N/A';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString('es-MX');
};

const daysOverdue = (dueDate) => {
  if (!dueDate) return 0;
  const due = new Date(dueDate);
  if (isNaN(due.getTime())) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.floor((today - due) / (1000 * 60 * 60 * 24));
};

const STATUS_OPTIONS = [
  { value: '',          label: 'Todos' },
  { value: 'pending',   label: 'Pendiente' },
  { value: 'partial',   label: 'Parcial' },
  { value: 'paid',      label: 'Pagada' },
  { value: 'cancelled', label: 'Cancelada' },
];

/**
 * Lista de notas (compartida para CxC y CxP).
 *
 * Props:
 *  - type: 'receivable' | 'payable'
 *  - title: string
 */
export default function NotesList({ type, title }) {
  const toast = useToast();
  const [notes, setNotes] = useState([]);
  const [aging, setAging] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Modales
  const [showForm, setShowForm] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [detailNote, setDetailNote] = useState(null);
  const [paymentNote, setPaymentNote] = useState(null);

  const isReceivable = type === 'receivable';

  useEffect(() => {
    loadNotes();
  }, [type]);

  const loadNotes = async () => {
    setLoading(true);
    setError(null);
    try {
      const [notesRes, agingRes] = await Promise.all([
        notesService.getNotes({ type, status: statusFilter || undefined }),
        notesService.getAging(type).catch(() => null),
      ]);
      const list = notesRes.data || [];
      setNotes(list);
      // Si el backend no devolvió aging estructurado, calculamos
      setAging(agingRes?.buckets ? agingRes : computeAgingClient(list));
    } catch (err) {
      setError(err.message || 'Error al cargar notas');
      toast.error('Error al cargar notas');
    } finally {
      setLoading(false);
    }
  };

  // Refrescar al cambiar filtro de estado
  useEffect(() => {
    loadNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  // ─── Filtro + paginación client-side ───
  const filteredNotes = useMemo(() => {
    if (!searchQuery) return notes;
    const q = searchQuery.toLowerCase();
    return notes.filter(n =>
      (n.contactName || '').toLowerCase().includes(q) ||
      (n.contactRfc || '').toLowerCase().includes(q) ||
      (n.reference || '').toLowerCase().includes(q) ||
      (n.concept || '').toLowerCase().includes(q) ||
      (n.folio || '').toLowerCase().includes(q)
    );
  }, [notes, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredNotes.length / itemsPerPage));
  const displayedNotes = filteredNotes.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // ─── Resumen (totales) ───
  const summary = useMemo(() => {
    const totalAmount = notes.reduce((s, n) => s + Number(n.amount || 0), 0);
    const totalPaid   = notes.reduce((s, n) => s + Number(n.paidAmount || 0), 0);
    const totalBalance = notes.reduce(
      (s, n) => s + Number(n.balance ?? (n.amount - (n.paidAmount || 0))), 0
    );
    const overdue = notes.filter(n => {
      const bal = Number(n.balance ?? (n.amount - (n.paidAmount || 0)));
      return bal > 0 && daysOverdue(n.dueDate) > 0;
    }).length;
    return { totalAmount, totalPaid, totalBalance, overdue, count: notes.length };
  }, [notes]);

  // ─── Handlers CRUD ───
  const handleSave = async (data) => {
    if (editingNote) {
      await notesService.updateNote(editingNote._id, data);
      toast.success('Nota actualizada');
    } else {
      await notesService.createNote(data);
      toast.success('Nota creada');
    }
    setEditingNote(null);
    setShowForm(false);
    await loadNotes();
  };

  const handleCancel = async (note) => {
    if (!confirm(`¿Cancelar la nota "${note.concept}"? Esta acción no se puede deshacer.`)) return;
    try {
      await notesService.cancelNote(note._id, 'Cancelada desde POS', note.type || type);
      toast.success('Nota cancelada');
      await loadNotes();
    } catch (err) {
      toast.error(err.message || 'Error al cancelar');
    }
  };

  const handleAddPayment = async (paymentData) => {
    const noteType = paymentNote.type || type;
    await notesService.addPayment(paymentNote._id, paymentData, noteType);
    toast.success('Abono registrado');
    // Refrescar detalle si está abierto
    if (detailNote && detailNote._id === paymentNote._id) {
      const updated = await notesService.getNoteById(paymentNote._id, noteType);
      setDetailNote(updated);
    }
    await loadNotes();
  };

  // ─── Render ───
  return (
    <div className="notes-page">
      <div className="notes-header">
        <h1>{title}</h1>
        <button
          className="btn btn-primary"
          onClick={() => { setEditingNote(null); setShowForm(true); }}
        >
          + Nueva Nota
        </button>
      </div>

      {error && (
        <div className="error-banner" style={{ background: '#fee2e2', color: '#991b1b', padding: '0.75rem 1rem', borderRadius: 6, marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {/* Resumen */}
      <div className="notes-summary">
        <div className="notes-summary-card">
          <div className="label">Notas</div>
          <div className="value">{summary.count}</div>
        </div>
        <div className="notes-summary-card">
          <div className="label">Monto total</div>
          <div className="value">${summary.totalAmount.toFixed(2)}</div>
        </div>
        <div className="notes-summary-card success">
          <div className="label">Cobrado/Pagado</div>
          <div className="value">${summary.totalPaid.toFixed(2)}</div>
        </div>
        <div className="notes-summary-card danger">
          <div className="label">Saldo pendiente</div>
          <div className="value">${summary.totalBalance.toFixed(2)}</div>
        </div>
        {summary.overdue > 0 && (
          <div className="notes-summary-card warning">
            <div className="label">Vencidas</div>
            <div className="value">{summary.overdue}</div>
          </div>
        )}
      </div>

      {/* Antigüedad de saldos */}
      {aging && <AgingReport aging={aging} title="Antigüedad de Saldos" />}

      {/* Filtros */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: 1, minWidth: 240, marginBottom: 0 }}>
            <label>Buscar</label>
            <input
              type="text"
              placeholder="Buscar por contacto, RFC, referencia o concepto..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0, minWidth: 160 }}>
            <label>Estado</label>
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}>
              {STATUS_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <button type="button" className="btn" onClick={loadNotes} style={{ background: 'var(--gray-200)', color: 'var(--gray-700)' }}>
            ↻ Refrescar
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="card">
        {loading && notes.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--gray-500)' }}>Cargando...</div>
        ) : filteredNotes.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--gray-500)' }}>
            No hay notas {searchQuery || statusFilter ? 'con ese filtro' : 'registradas'}
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="notes-table">
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>{isReceivable ? 'Cliente' : 'Proveedor'}</th>
                    <th>Concepto</th>
                    <th>Emisión</th>
                    <th>Vence</th>
                    <th style={{ textAlign: 'right' }}>Monto</th>
                    <th style={{ textAlign: 'right' }}>Saldo</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedNotes.map((n) => {
                    const balance = Number(n.balance ?? (n.amount - (n.paidAmount || 0)));
                    const overdue = balance > 0 && daysOverdue(n.dueDate) > 0 && n.status !== 'cancelled';
                    return (
                      <tr key={n._id} className={overdue ? 'overdue-row' : ''}>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--gray-700)', whiteSpace: 'nowrap' }}>
                          {n.folio || '—'}
                        </td>
                        <td>
                          <div style={{ fontWeight: 500 }}>{n.contactName}</div>
                          {n.contactRfc && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>{n.contactRfc}</div>
                          )}
                        </td>
                        <td>
                          <div>{n.concept}</div>
                          {n.reference && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>Ref: {n.reference}</div>
                          )}
                        </td>
                        <td>{formatDate(n.issueDate)}</td>
                        <td>
                          {formatDate(n.dueDate)}
                          {overdue && (
                            <div style={{ fontSize: '0.7rem', color: '#dc2626', fontWeight: 600 }}>
                              {daysOverdue(n.dueDate)}d vencido
                            </div>
                          )}
                        </td>
                        <td className="amount-cell">${Number(n.amount || 0).toFixed(2)}</td>
                        <td className="amount-cell" style={{ color: balance > 0 ? '#dc2626' : '#10b981' }}>
                          ${balance.toFixed(2)}
                        </td>
                        <td>
                          <span className={`notes-badge ${n.status || 'pending'}`}>
                            {({ pending: 'Pendiente', partial: 'Parcial', paid: isReceivable ? 'Cobrada' : 'Pagada', cancelled: 'Cancelada' })[n.status] || n.status}
                          </span>
                        </td>
                        <td>
                          <div className="actions-cell">
                            <button
                              className="btn btn-sm"
                              style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                              onClick={() => setDetailNote(n)}
                              title="Ver detalle"
                            >
                              👁
                            </button>
                            {n.status !== 'paid' && n.status !== 'cancelled' && (
                              <>
                                <button
                                  className="btn btn-sm"
                                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', background: '#10b981', color: 'white' }}
                                  onClick={() => setPaymentNote(n)}
                                  title="Registrar abono"
                                >
                                  💵
                                </button>
                                <button
                                  className="btn btn-sm"
                                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                                  onClick={() => { setEditingNote(n); setShowForm(true); }}
                                  title="Editar"
                                >
                                  ✏️
                                </button>
                              </>
                            )}
                            {n.status !== 'cancelled' && (
                              <button
                                className="btn btn-sm"
                                style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', color: '#dc2626' }}
                                onClick={() => handleCancel(n)}
                                title="Cancelar nota"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
                <button className="btn" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>« Primera</button>
                <button className="btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>‹ Anterior</button>
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                  Página {currentPage} de {totalPages}
                </span>
                <button className="btn" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Siguiente ›</button>
                <button className="btn" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>Última »</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modales */}
      <NoteModal
        open={showForm}
        onClose={() => { setShowForm(false); setEditingNote(null); }}
        onSave={handleSave}
        initial={editingNote}
        type={type}
      />

      <PaymentModal
        open={!!paymentNote}
        onClose={() => setPaymentNote(null)}
        onSave={handleAddPayment}
        note={paymentNote}
      />

      <NoteDetailModal
        open={!!detailNote}
        onClose={() => setDetailNote(null)}
        note={detailNote}
        onAddPayment={() => { setPaymentNote(detailNote); }}
        onChanged={loadNotes}
      />
    </div>
  );
}
