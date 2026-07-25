import { useState, useEffect, useMemo } from 'react';
import { notasPorCobrarService, clientService } from '../services/api';
import './NotasPorCobrar.css';

const fmtMoney = (n) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(
    Number(n) || 0
  );

const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: '2-digit' });
};

const STATUS_LABELS = {
  pendiente: 'Pendiente',
  parcial: 'Parcial',
  pagada: 'Pagada',
  vencida: 'Vencida',
  cancelada: 'Cancelada',
};

const STATUS_TONE = {
  pendiente: 'badge--neutral',
  parcial: 'badge--info',
  pagada: 'badge--success',
  vencida: 'badge--danger',
  cancelada: 'badge--muted',
};

const initialForm = {
  clienteId: '',
  invoiceId: '',
  montoTotal: '',
  fechaVencimiento: '',
  concepto: '',
  descripcion: '',
  permiteParcialidades: true,
  notas: '',
};

const initialAbonoForm = {
  monto: '',
  fecha: new Date().toISOString().slice(0, 10),
  metodoPago: '01',
  referencia: '',
  notas: '',
};

export default function NotasPorCobrar() {
  // --- Estado principal ---
  const [notas, setNotas] = useState([]);
  const [summary, setSummary] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Filtros
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  // Modales
  const [showCreate, setShowCreate] = useState(false);
  const [showAbono, setShowAbono] = useState(false);
  const [showDetail, setShowDetail] = useState(null); // nota seleccionada
  const [showCancel, setShowCancel] = useState(null);
  const [cancelMotivo, setCancelMotivo] = useState('');

  // Forms
  const [form, setForm] = useState(initialForm);
  const [abonoForm, setAbonoForm] = useState(initialAbonoForm);
  const [saving, setSaving] = useState(false);

  // --- Carga inicial ---
  useEffect(() => {
    loadAll();
    clientService
      .getAllClients({ limit: 200 })
      .then((r) => setClientes(r.data || []))
      .catch(() => {});
  }, []);

  const loadAll = async () => {
    try {
      setLoading(true);
      setError(null);
      const [list, sum] = await Promise.all([
        notasPorCobrarService.list({ limit: 200, activas: 'true' }),
        notasPorCobrarService.summary(true),
      ]);
      setNotas(list.data || []);
      setSummary(sum.data || null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // --- Filtro cliente ---
  const notasFiltradas = useMemo(() => {
    const q = search.toLowerCase().trim();
    return notas.filter((n) => {
      if (statusFilter && n.status !== statusFilter) return false;
      if (!q) return true;
      return (
        (n.folio || '').toLowerCase().includes(q) ||
        (n.clienteSnapshot?.nombre || '').toLowerCase().includes(q) ||
        (n.clienteSnapshot?.rfc || '').toLowerCase().includes(q) ||
        (n.concepto || '').toLowerCase().includes(q)
      );
    });
  }, [notas, statusFilter, search]);

  // --- Crear nota ---
  const openCreate = () => {
    setForm(initialForm);
    setShowCreate(true);
  };

  const submitCreate = async (e) => {
    e.preventDefault();
    if (!form.montoTotal || Number(form.montoTotal) <= 0) {
      setError('montoTotal debe ser mayor a 0');
      return;
    }
    if (!form.fechaVencimiento) {
      setError('fechaVencimiento es requerida');
      return;
    }
    try {
      setSaving(true);
      const payload = {
        montoTotal: Number(form.montoTotal),
        fechaVencimiento: form.fechaVencimiento,
        concepto: form.concepto,
        descripcion: form.descripcion,
        permiteParcialidades: form.permiteParcialidades,
        notas: form.notas,
      };
      if (form.clienteId) payload.clienteId = form.clienteId;
      if (form.invoiceId) payload.invoiceId = form.invoiceId;
      await notasPorCobrarService.create(payload);
      setShowCreate(false);
      await loadAll();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // --- Registrar abono ---
  const openAbono = (nota) => {
    setShowAbono(nota);
    setAbonoForm(initialAbonoForm);
  };

  const submitAbono = async (e) => {
    e.preventDefault();
    if (!abonoForm.monto || Number(abonoForm.monto) <= 0) {
      setError('monto del abono debe ser mayor a 0');
      return;
    }
    try {
      setSaving(true);
      const updated = await notasPorCobrarService.addAbono(showAbono._id, {
        monto: Number(abonoForm.monto),
        fecha: abonoForm.fecha,
        metodoPago: abonoForm.metodoPago,
        referencia: abonoForm.referencia,
        notas: abonoForm.notas,
      });
      setShowAbono(null);
      // refrescar detalle si está abierto
      if (showDetail && showDetail._id === updated.data._id) {
        setShowDetail(updated.data);
      }
      await loadAll();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // --- Eliminar abono ---
  const handleRemoveAbono = async (nota, abono) => {
    if (!confirm(`¿Eliminar el abono de ${fmtMoney(abono.monto)}?`)) return;
    try {
      const updated = await notasPorCobrarService.removeAbono(nota._id, abono._id);
      if (showDetail && showDetail._id === updated.data._id) {
        setShowDetail(updated.data);
      }
      await loadAll();
    } catch (e) {
      setError(e.message);
    }
  };

  // --- Cancelar nota ---
  const submitCancel = async () => {
    try {
      setSaving(true);
      await notasPorCobrarService.cancel(showCancel._id, cancelMotivo);
      setShowCancel(null);
      setCancelMotivo('');
      if (showDetail && showDetail._id === showCancel._id) {
        setShowDetail(null);
      }
      await loadAll();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // --- Eliminar (soft) nota sin abonos ---
  const handleDelete = async (n) => {
    if (!confirm(`¿Eliminar la nota ${n.folio}?`)) return;
    try {
      await notasPorCobrarService.delete(n._id);
      if (showDetail && showDetail._id === n._id) setShowDetail(null);
      await loadAll();
    } catch (e) {
      setError(e.message);
    }
  };

  // --- Vista detalle ---
  const openDetail = async (n) => {
    try {
      const r = await notasPorCobrarService.getById(n._id);
      setShowDetail(r.data);
    } catch (e) {
      setError(e.message);
    }
  };

  // ============== RENDER ==============
  return (
    <div className="npc-page">
      <header className="page-header">
        <div>
          <h1>Notas por Cobrar</h1>
          <p className="page-header__subtitle">
            Ventas a crédito y seguimiento de abonos.
          </p>
        </div>
        <button className="btn btn--primary" onClick={openCreate}>
          + Nueva nota
        </button>
      </header>

      {error && (
        <div className="alert alert--error" onClick={() => setError(null)}>
          {error}
        </div>
      )}

      {/* --- KPIs --- */}
      {summary && (
        <section className="npc-kpi-grid">
          <Kpi
            label="Por cobrar"
            value={fmtMoney(summary.totales?.saldo)}
            hint={`${summary.totales?.count || 0} notas vigentes`}
            tone="primary"
          />
          <Kpi
            label="Cobrado"
            value={fmtMoney(summary.totales?.montoAbonado)}
            hint={`de ${fmtMoney(summary.totales?.montoTotal)}`}
            tone="success"
          />
          <Kpi
            label="Vencidas"
            value={summary.vencidas?.count || 0}
            hint={fmtMoney(summary.vencidas?.saldo)}
            tone="danger"
          />
          <Kpi
            label="% Cobrado"
            value={
              summary.totales?.montoTotal > 0
                ? `${Math.round(
                    (summary.totales.montoAbonado / summary.totales.montoTotal) * 100
                  )}%`
                : '—'
            }
            hint="global"
            tone="info"
          />
        </section>
      )}

      {/* --- Filtros --- */}
      <section className="npc-filters">
        <input
          type="text"
          placeholder="Buscar por folio, cliente, RFC o concepto…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input"
        >
          <option value="">Todos los status</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <button className="btn btn--ghost" onClick={loadAll} disabled={loading}>
          {loading ? 'Cargando…' : '↻ Refrescar'}
        </button>
      </section>

      {/* --- Tabla --- */}
      <section className="npc-table-wrapper">
        <table className="npc-table">
          <thead>
            <tr>
              <th>Folio</th>
              <th>Cliente</th>
              <th>Concepto</th>
              <th className="num">Total</th>
              <th className="num">Saldo</th>
              <th>Vence</th>
              <th>Status</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && notas.length === 0 && (
              <tr>
                <td colSpan="8" className="empty-row">Cargando…</td>
              </tr>
            )}
            {!loading && notasFiltradas.length === 0 && (
              <tr>
                <td colSpan="8" className="empty-row">No hay notas por cobrar</td>
              </tr>
            )}
            {notasFiltradas.map((n) => {
              const saldo = (n.montoTotal || 0) - (n.montoAbonado || 0);
              const vencidaReal =
                n.status !== 'pagada' &&
                n.status !== 'cancelada' &&
                n.status !== 'vencida' &&
                new Date(n.fechaVencimiento) < new Date();
              const displayStatus = vencidaReal ? 'vencida' : n.status;
              return (
                <tr key={n._id}>
                  <td className="mono">{n.folio}</td>
                  <td>
                    <div className="cell-strong">
                      {n.clienteSnapshot?.nombre || '—'}
                    </div>
                    {n.clienteSnapshot?.rfc && (
                      <div className="cell-muted mono">{n.clienteSnapshot.rfc}</div>
                    )}
                  </td>
                  <td className="cell-truncate" title={n.concepto}>
                    {n.concepto || '—'}
                  </td>
                  <td className="num">{fmtMoney(n.montoTotal)}</td>
                  <td className={`num ${saldo > 0 ? 'cell-strong' : 'cell-muted'}`}>
                    {fmtMoney(saldo)}
                  </td>
                  <td className={vencidaReal ? 'cell-danger' : ''}>
                    {fmtDate(n.fechaVencimiento)}
                  </td>
                  <td>
                    <span className={`badge ${STATUS_TONE[displayStatus] || ''}`}>
                      {STATUS_LABELS[displayStatus]}
                    </span>
                  </td>
                  <td>
                    <div className="actions">
                      <button
                        className="btn btn--sm"
                        onClick={() => openDetail(n)}
                        title="Ver detalle"
                      >
                        Ver
                      </button>
                      {n.status !== 'pagada' &&
                        n.status !== 'cancelada' &&
                        n.permiteParcialidades && (
                          <button
                            className="btn btn--sm btn--primary"
                            onClick={() => openAbono(n)}
                            title="Registrar abono"
                          >
                            + Abono
                          </button>
                        )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* --- Top deudores --- */}
      {summary?.topDeudores?.length > 0 && (
        <section className="npc-section">
          <h3>Top deudores</h3>
          <div className="npc-deudores">
            {summary.topDeudores.map((d) => (
              <div className="deudor-card" key={d.clienteId || d.rfc}>
                <div className="deudor-card__name">{d.nombre || '—'}</div>
                <div className="deudor-card__rfc mono">{d.rfc || '—'}</div>
                <div className="deudor-card__amount">{fmtMoney(d.saldo)}</div>
                <div className="deudor-card__count">
                  {d.count} nota{d.count !== 1 ? 's' : ''}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ====== Modal: Crear ====== */}
      {showCreate && (
        <div className="modal-backdrop" onClick={() => !saving && setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <header className="modal__header">
              <h2>Nueva nota por cobrar</h2>
              <button className="modal__close" onClick={() => setShowCreate(false)}>
                ×
              </button>
            </header>
            <form onSubmit={submitCreate} className="modal__body">
              <div className="form-row">
                <label>Cliente</label>
                <select
                  value={form.clienteId}
                  onChange={(e) => setForm({ ...form, clienteId: e.target.value })}
                  className="input"
                >
                  <option value="">(Sin cliente)</option>
                  {clientes.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.nombre} — {c.rfc}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-row form-row--grid">
                <div>
                  <label>Monto total *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={form.montoTotal}
                    onChange={(e) => setForm({ ...form, montoTotal: e.target.value })}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label>Fecha de vencimiento *</label>
                  <input
                    type="date"
                    value={form.fechaVencimiento}
                    onChange={(e) =>
                      setForm({ ...form, fechaVencimiento: e.target.value })
                    }
                    className="input"
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <label>Concepto</label>
                <input
                  type="text"
                  value={form.concepto}
                  onChange={(e) => setForm({ ...form, concepto: e.target.value })}
                  className="input"
                  placeholder="Ej: Venta a crédito mesa 4"
                />
              </div>
              <div className="form-row">
                <label>Descripción</label>
                <textarea
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  className="input"
                  rows="2"
                />
              </div>
              <div className="form-row form-row--check">
                <label>
                  <input
                    type="checkbox"
                    checked={form.permiteParcialidades}
                    onChange={(e) =>
                      setForm({ ...form, permiteParcialidades: e.target.checked })
                    }
                  />
                  Permitir abonos parciales
                </label>
              </div>
              <div className="form-row">
                <label>Notas</label>
                <textarea
                  value={form.notas}
                  onChange={(e) => setForm({ ...form, notas: e.target.value })}
                  className="input"
                  rows="2"
                />
              </div>
              <footer className="modal__footer">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setShowCreate(false)}
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn--primary" disabled={saving}>
                  {saving ? 'Guardando…' : 'Crear nota'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* ====== Modal: Abono ====== */}
      {showAbono && (
        <div className="modal-backdrop" onClick={() => !saving && setShowAbono(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <header className="modal__header">
              <h2>Registrar abono</h2>
              <button className="modal__close" onClick={() => setShowAbono(null)}>
                ×
              </button>
            </header>
            <form onSubmit={submitAbono} className="modal__body">
              <div className="abono-info">
                <div>
                  <strong>{showAbono.folio}</strong> —{' '}
                  {showAbono.clienteSnapshot?.nombre || '—'}
                </div>
                <div>
                  Saldo pendiente:{' '}
                  <strong>
                    {fmtMoney(
                      (showAbono.montoTotal || 0) - (showAbono.montoAbonado || 0)
                    )}
                  </strong>
                </div>
              </div>
              <div className="form-row form-row--grid">
                <div>
                  <label>Monto *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={
                      (showAbono.montoTotal || 0) - (showAbono.montoAbonado || 0)
                    }
                    value={abonoForm.monto}
                    onChange={(e) =>
                      setAbonoForm({ ...abonoForm, monto: e.target.value })
                    }
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label>Fecha</label>
                  <input
                    type="date"
                    value={abonoForm.fecha}
                    onChange={(e) =>
                      setAbonoForm({ ...abonoForm, fecha: e.target.value })
                    }
                    className="input"
                  />
                </div>
              </div>
              <div className="form-row form-row--grid">
                <div>
                  <label>Método de pago</label>
                  <select
                    value={abonoForm.metodoPago}
                    onChange={(e) =>
                      setAbonoForm({ ...abonoForm, metodoPago: e.target.value })
                    }
                    className="input"
                  >
                    <option value="01">01 - Efectivo</option>
                    <option value="02">02 - Cheque nominativo</option>
                    <option value="03">03 - Transferencia</option>
                    <option value="04">04 - Tarjeta de crédito</option>
                    <option value="28">28 - Tarjeta de débito</option>
                    <option value="99">99 - Por definir</option>
                  </select>
                </div>
                <div>
                  <label>Referencia</label>
                  <input
                    type="text"
                    value={abonoForm.referencia}
                    onChange={(e) =>
                      setAbonoForm({ ...abonoForm, referencia: e.target.value })
                    }
                    className="input"
                    placeholder="SPEI, cheque, etc."
                  />
                </div>
              </div>
              <div className="form-row">
                <label>Notas</label>
                <textarea
                  value={abonoForm.notas}
                  onChange={(e) =>
                    setAbonoForm({ ...abonoForm, notas: e.target.value })
                  }
                  className="input"
                  rows="2"
                />
              </div>
              <footer className="modal__footer">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setShowAbono(null)}
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn--primary" disabled={saving}>
                  {saving ? 'Registrando…' : 'Registrar'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* ====== Modal: Detalle ====== */}
      {showDetail && (
        <div className="modal-backdrop" onClick={() => setShowDetail(null)}>
          <div className="modal modal--lg" onClick={(e) => e.stopPropagation()}>
            <header className="modal__header">
              <div>
                <h2>{showDetail.folio}</h2>
                <div className="cell-muted">
                  {showDetail.clienteSnapshot?.nombre || 'Sin cliente'}
                </div>
              </div>
              <button className="modal__close" onClick={() => setShowDetail(null)}>
                ×
              </button>
            </header>
            <div className="modal__body">
              <div className="detail-grid">
                <DetailField label="Concepto" value={showDetail.concepto || '—'} />
                <DetailField
                  label="Status"
                  value={
                    <span className={`badge ${STATUS_TONE[showDetail.status] || ''}`}>
                      {STATUS_LABELS[showDetail.status]}
                    </span>
                  }
                />
                <DetailField label="Total" value={fmtMoney(showDetail.montoTotal)} />
                <DetailField
                  label="Abonado"
                  value={fmtMoney(showDetail.montoAbonado)}
                />
                <DetailField
                  label="Saldo"
                  value={
                    <strong
                      className={
                        showDetail.montoTotal - showDetail.montoAbonado > 0
                          ? 'cell-danger'
                          : 'cell-success'
                      }
                    >
                      {fmtMoney(
                        (showDetail.montoTotal || 0) - (showDetail.montoAbonado || 0)
                      )}
                    </strong>
                  }
                />
                <DetailField
                  label="% Pagado"
                  value={
                    showDetail.montoTotal > 0
                      ? `${Math.round(
                          (showDetail.montoAbonado / showDetail.montoTotal) * 100
                        )}%`
                      : '—'
                  }
                />
                <DetailField
                  label="Emisión"
                  value={fmtDate(showDetail.fechaEmision)}
                />
                <DetailField
                  label="Vencimiento"
                  value={fmtDate(showDetail.fechaVencimiento)}
                />
                <DetailField
                  label="Factura vinculada"
                  value={showDetail.invoiceUuid || '—'}
                />
              </div>

              {showDetail.descripcion && (
                <div className="detail-section">
                  <h4>Descripción</h4>
                  <p>{showDetail.descripcion}</p>
                </div>
              )}

              <div className="detail-section">
                <h4>Abonos ({showDetail.abonos?.length || 0})</h4>
                {showDetail.abonos?.length > 0 ? (
                  <table className="npc-table npc-table--compact">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Método</th>
                        <th>Referencia</th>
                        <th className="num">Monto</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {showDetail.abonos.map((a) => (
                        <tr key={a._id}>
                          <td>{fmtDate(a.fecha)}</td>
                          <td>{a.metodoPago}</td>
                          <td className="mono">{a.referencia || '—'}</td>
                          <td className="num">{fmtMoney(a.monto)}</td>
                          <td>
                            {showDetail.status !== 'pagada' &&
                              showDetail.status !== 'cancelada' && (
                                <button
                                  className="btn btn--sm btn--danger-ghost"
                                  onClick={() => handleRemoveAbono(showDetail, a)}
                                >
                                  ×
                                </button>
                              )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="empty-row">Sin abonos aún</div>
                )}
              </div>

              {showDetail.notas && (
                <div className="detail-section">
                  <h4>Notas</h4>
                  <p>{showDetail.notas}</p>
                </div>
              )}

              <footer className="modal__footer">
                {showDetail.status !== 'pagada' &&
                  showDetail.status !== 'cancelada' &&
                  showDetail.montoAbonado === 0 && (
                    <button
                      className="btn btn--danger-ghost"
                      onClick={() => handleDelete(showDetail)}
                    >
                      Eliminar
                    </button>
                  )}
                {showDetail.status !== 'pagada' &&
                  showDetail.status !== 'cancelada' &&
                  showDetail.montoAbonado === 0 && (
                    <button
                      className="btn btn--danger-ghost"
                      onClick={() => {
                        setShowCancel(showDetail);
                      }}
                    >
                      Cancelar nota
                    </button>
                  )}
                {showDetail.status !== 'pagada' &&
                  showDetail.status !== 'cancelada' &&
                  showDetail.permiteParcialidades && (
                    <button
                      className="btn btn--primary"
                      onClick={() => openAbono(showDetail)}
                    >
                      + Registrar abono
                    </button>
                  )}
                <button className="btn btn--ghost" onClick={() => setShowDetail(null)}>
                  Cerrar
                </button>
              </footer>
            </div>
          </div>
        </div>
      )}

      {/* ====== Modal: Cancelar ====== */}
      {showCancel && (
        <div
          className="modal-backdrop"
          onClick={() => !saving && setShowCancel(null)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <header className="modal__header">
              <h2>Cancelar nota {showCancel.folio}</h2>
              <button className="modal__close" onClick={() => setShowCancel(null)}>
                ×
              </button>
            </header>
            <div className="modal__body">
              <div className="form-row">
                <label>Motivo de cancelación</label>
                <textarea
                  value={cancelMotivo}
                  onChange={(e) => setCancelMotivo(e.target.value)}
                  className="input"
                  rows="3"
                  placeholder="¿Por qué se cancela?"
                />
              </div>
              <footer className="modal__footer">
                <button
                  className="btn btn--ghost"
                  onClick={() => setShowCancel(null)}
                  disabled={saving}
                >
                  Volver
                </button>
                <button
                  className="btn btn--danger"
                  onClick={submitCancel}
                  disabled={saving}
                >
                  {saving ? 'Cancelando…' : 'Confirmar cancelación'}
                </button>
              </footer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==== subcomponentes ====
function Kpi({ label, value, hint, tone = 'neutral' }) {
  return (
    <div className={`kpi-card kpi-card--${tone}`}>
      <div className="kpi-card__label">{label}</div>
      <div className="kpi-card__value">{value}</div>
      {hint && <div className="kpi-card__hint">{hint}</div>}
    </div>
  );
}

function DetailField({ label, value }) {
  return (
    <div className="detail-field">
      <div className="detail-field__label">{label}</div>
      <div className="detail-field__value">{value}</div>
    </div>
  );
}
