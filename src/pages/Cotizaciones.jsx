import { useState, useEffect, useCallback } from 'react';
import { cotizacionService } from '../services/cotizacionService';
import { useToast } from '../components/ui/Toast.jsx';
import CotizacionModal from '../components/CotizacionModal';
import CotizacionDetail from '../components/CotizacionDetail';
import './Cotizaciones.css';

const ESTADO_BADGE = {
  borrador:  { label: 'Borrador',  cls: 'badge-secondary' },
  enviada:   { label: 'Enviada',   cls: 'badge-info' },
  aceptada:  { label: 'Aceptada',  cls: 'badge-success' },
  rechazada: { label: 'Rechazada', cls: 'badge-danger' },
  vencida:   { label: 'Vencida',   cls: 'badge-warning' },
  facturada: { label: 'Facturada', cls: 'badge-primary' },
};

const fmt = (n) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-MX') : '—';

export default function Cotizaciones() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const [estadoFilter, setEstadoFilter] = useState('todas');
  const [searchQuery, setSearchQuery] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);     // cotización a editar (solo borrador)
  const [viewing, setViewing] = useState(null);     // cotización a ver en detalle

  const [stats, setStats] = useState(null);

  const toast = useToast();

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [listRes, statsRes] = await Promise.all([
        cotizacionService.list({ page, limit, estado: estadoFilter, searchQuery }),
        cotizacionService.stats().catch(() => null),
      ]);
      const list = listRes?.data?.cotizaciones || listRes?.cotizaciones || [];
      const pagination = listRes?.data?.pagination || listRes?.pagination || {};
      setItems(list);
      setTotalPages(pagination.pages || 1);
      setTotal(pagination.total || list.length);
      if (statsRes?.data?.counts) setStats(statsRes.data.counts);
    } catch (err) {
      toast?.error?.(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, estadoFilter, searchQuery, toast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const onCreated = () => { setShowCreate(false); fetchAll(); };
  const onEdited  = () => { setEditing(null);  fetchAll(); };
  const onAction  = () => { setViewing(null);  fetchAll(); };

  const handleAction = async (action, id, opts = {}) => {
    try {
      const res = await action(id, opts);
      toast?.success?.(res?.message || 'Acción completada');
      onAction();
    } catch (err) {
      toast?.error?.(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta cotización?')) return;
    handleAction(cotizacionService.remove, id);
  };

  return (
    <div className="cotizaciones-page">
      <div className="page-header">
        <h1>📋 Cotizaciones</h1>
        <div className="page-header-actions">
          <button
            className="btn btn-primary"
            onClick={() => setShowCreate(true)}
          >
            + Nueva cotización
          </button>
        </div>
      </div>

      {stats && (
        <div className="stats-grid">
          {Object.entries(stats).map(([k, v]) => (
            <div key={k} className={`stat-card stat-${k}`}>
              <div className="stat-value">{v}</div>
              <div className="stat-label">{ESTADO_BADGE[k]?.label || k}</div>
            </div>
          ))}
        </div>
      )}

      <div className="filters-bar">
        <select
          className="filter-select"
          value={estadoFilter}
          onChange={(e) => { setEstadoFilter(e.target.value); setPage(1); }}
        >
          <option value="todas">Todos los estados</option>
          {Object.entries(ESTADO_BADGE).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <input
          type="text"
          className="filter-input"
          placeholder="Buscar por folio, cliente, RFC…"
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
        />
      </div>

      {loading ? (
        <div className="loading">Cargando cotizaciones…</div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <p>No hay cotizaciones {estadoFilter !== 'todas' ? `en estado "${estadoFilter}"` : ''}.</p>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            Crear la primera
          </button>
        </div>
      ) : (
        <>
          <table className="data-table">
            <thead>
              <tr>
                <th>Folio</th>
                <th>Cliente</th>
                <th>Items</th>
                <th>Total</th>
                <th>Vigencia</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => {
                const badge = ESTADO_BADGE[c.estado] || { label: c.estado, cls: 'badge-secondary' };
                return (
                  <tr key={c._id}>
                    <td><strong>{c.folio}</strong></td>
                    <td>
                      <div>{c.clienteSnapshot?.nombre || '—'}</div>
                      <small className="muted">{c.clienteSnapshot?.rfc || ''}</small>
                    </td>
                    <td>{c.items?.length || 0}</td>
                    <td className="amount">{fmt(c.total)}</td>
                    <td>{fmtDate(c.vigencia)}</td>
                    <td><span className={`badge ${badge.cls}`}>{badge.label}</span></td>
                    <td className="actions">
                      <button className="btn-icon" title="Ver" onClick={() => setViewing(c)}>👁</button>
                      {c.estado === 'borrador' && (
                        <>
                          <button className="btn-icon" title="Editar" onClick={() => setEditing(c)}>✏️</button>
                          <button className="btn-icon" title="Eliminar" onClick={() => handleDelete(c._id)}>🗑</button>
                        </>
                      )}
                      <a
                        className="btn-icon"
                        title="PDF"
                        href={cotizacionService.pdfUrl(c._id)}
                        target="_blank"
                        rel="noreferrer"
                      >📄</a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="pagination">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}>‹ Anterior</button>
            <span>Página {page} de {totalPages} ({total} total)</span>
            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Siguiente ›</button>
          </div>
        </>
      )}

      {showCreate && (
        <CotizacionModal onClose={() => setShowCreate(false)} onSaved={onCreated} />
      )}
      {editing && (
        <CotizacionModal
          cotizacion={editing}
          onClose={() => setEditing(null)}
          onSaved={onEdited}
        />
      )}
      {viewing && (
        <CotizacionDetail
          cotizacion={viewing}
          onClose={() => setViewing(null)}
          onAction={async (fn, id, opts) => {
            await handleAction(fn, id, opts);
            // Re-fetch the viewed one to show updated state
            try {
              const fresh = await cotizacionService.get(id);
              if (fresh?.data?.cotizacion) setViewing(fresh.data.cotizacion);
            } catch (e) { /* ignore */ }
          }}
        />
      )}
    </div>
  );
}
