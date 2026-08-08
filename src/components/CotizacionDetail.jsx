import { useState } from 'react';
import { cotizacionService } from '../services/cotizacionService';
import { useToast } from './ui/Toast.jsx';
import './Modal.css';

const fmt = (n) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-MX', { dateStyle: 'long' }) : '—';

const ESTADO = {
  borrador:  { label: 'Borrador',  cls: 'badge-secondary' },
  enviada:   { label: 'Enviada',   cls: 'badge-info' },
  aceptada:  { label: 'Aceptada',  cls: 'badge-success' },
  rechazada: { label: 'Rechazada', cls: 'badge-danger' },
  vencida:   { label: 'Vencida',   cls: 'badge-warning' },
  facturada: { label: 'Facturada', cls: 'badge-primary' },
};

export default function CotizacionDetail({ cotizacion, onClose, onAction }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const badge = ESTADO[cotizacion.estado] || { label: cotizacion.estado, cls: 'badge-secondary' };

  const can = {
    enviar:    cotizacion.estado === 'borrador',
    aceptar:   cotizacion.estado === 'enviada',
    rechazar:  cotizacion.estado === 'enviada' || cotizacion.estado === 'borrador',
    convertir: cotizacion.estado === 'aceptada',
  };

  const run = async (fn, label) => {
    setBusy(true);
    try {
      await onAction(fn, cotizacion._id);
    } catch (e) {
      toast?.error?.(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleEnviar = async () => {
    const email = window.prompt('Email destino (Enter para usar el del cliente):', cotizacion.clienteSnapshot?.email || '');
    if (email === null) return; // cancelado
    run((id) => cotizacionService.enviar(id, { email: email || undefined }), 'enviar');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 760, width: '100%' }}>
        <div className="modal-header">
          <h2>📋 {cotizacion.folio}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="detail-top">
            <div>
              <div className="muted">Estado</div>
              <span className={`badge ${badge.cls}`}>{badge.label}</span>
            </div>
            <div>
              <div className="muted">Vigencia</div>
              <strong>{fmtDate(cotizacion.vigencia)}</strong>
            </div>
            <div>
              <div className="muted">Total</div>
              <strong style={{ fontSize: 18, color: '#1c8a4a' }}>{fmt(cotizacion.total)}</strong>
            </div>
            <div>
              <div className="muted">Items</div>
              <strong>{cotizacion.items?.length || 0}</strong>
            </div>
          </div>

          {cotizacion.clienteSnapshot && (
            <section className="detail-section">
              <h3>Cliente</h3>
              <p>
                <strong>{cotizacion.clienteSnapshot.nombre}</strong>
                {cotizacion.clienteSnapshot.rfc && <><br />RFC: {cotizacion.clienteSnapshot.rfc}</>}
                {cotizacion.clienteSnapshot.email && <><br />📧 {cotizacion.clienteSnapshot.email}</>}
                {cotizacion.clienteSnapshot.telefono && <><br />📞 {cotizacion.clienteSnapshot.telefono}</>}
                {cotizacion.clienteSnapshot.direccion && <><br />📍 {cotizacion.clienteSnapshot.direccion}</>}
              </p>
            </section>
          )}

          <section className="detail-section">
            <h3>Items</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Descripción</th>
                  <th style={{ textAlign: 'right' }}>Cant.</th>
                  <th style={{ textAlign: 'right' }}>P. Unit</th>
                  <th style={{ textAlign: 'right' }}>Subtotal</th>
                  <th style={{ textAlign: 'right' }}>IVA</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {cotizacion.items?.map((it, i) => (
                  <tr key={i}>
                    <td>
                      {it.descripcion}
                      {it.sku && <><br /><small className="muted">{it.sku}</small></>}
                    </td>
                    <td style={{ textAlign: 'right' }}>{it.cantidad}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(it.precioUnitario)}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(it.subtotal)}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(it.iva)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(it.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <div className="detail-totals">
            <div><span>Subtotal</span><strong>{fmt(cotizacion.subtotal)}</strong></div>
            {cotizacion.descuento ? <div><span>Descuento</span><strong>− {fmt(cotizacion.descuento)}</strong></div> : null}
            <div><span>IVA</span><strong>{fmt(cotizacion.iva)}</strong></div>
            <div className="total-final"><span>Total</span><strong>{fmt(cotizacion.total)}</strong></div>
          </div>

          {cotizacion.condiciones && (
            <section className="detail-section">
              <h3>Condiciones</h3>
              <p>{cotizacion.condiciones}</p>
            </section>
          )}
          {cotizacion.notas && (
            <section className="detail-section">
              <h3>Notas</h3>
              <p>{cotizacion.notas}</p>
            </section>
          )}

          {cotizacion.emailEnviadoEn && (
            <p className="muted" style={{ marginTop: 12 }}>
              📧 Enviada a {cotizacion.emailEnviadoA} el {fmtDate(cotizacion.emailEnviadoEn)}
            </p>
          )}
          {cotizacion.facturadaEn && (
            <p className="muted" style={{ marginTop: 12 }}>
              ✅ Facturada el {fmtDate(cotizacion.facturadaEn)} — Invoice ID: {cotizacion.facturaId}
            </p>
          )}
        </div>

        <div className="modal-footer">
          <a
            className="btn btn-secondary"
            href={cotizacionService.pdfUrl(cotizacion._id)}
            target="_blank"
            rel="noreferrer"
          >
            📄 PDF
          </a>
          {can.rechazar && (
            <button className="btn btn-danger" disabled={busy} onClick={() => run(cotizacionService.rechazar, 'rechazar')}>
              Rechazar
            </button>
          )}
          {can.enviar && (
            <button className="btn btn-primary" disabled={busy} onClick={handleEnviar}>
              📧 Enviar al cliente
            </button>
          )}
          {can.aceptar && (
            <button className="btn btn-success" disabled={busy} onClick={() => run(cotizacionService.aceptar, 'aceptar')}>
              ✓ Aceptar
            </button>
          )}
          {can.convertir && (
            <button className="btn btn-primary" disabled={busy} onClick={() => run(cotizacionService.convertir, 'convertir')}>
              💼 Convertir a factura
            </button>
          )}
          <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
