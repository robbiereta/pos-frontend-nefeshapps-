import { useState, useEffect } from 'react';
import { invoiceService } from '../services/api';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { Skeleton, SkeletonStack } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import { useToast } from '../components/ui/Toast.jsx';

function formatMoney(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function invoiceTone(inv) {
  if (inv.uuid) return 'success';
  if (inv.status === 'cancelled' || inv.status === 'cancelada') return 'danger';
  if (inv.status === 'pending' || inv.status === 'pendiente') return 'warning';
  return 'info';
}

function invoiceLabel(inv) {
  if (inv.uuid) return 'Timbrada';
  if (inv.status === 'cancelled' || inv.status === 'cancelada') return 'Cancelada';
  if (inv.status === 'pending' || inv.status === 'pendiente') return 'Pendiente';
  return 'Borrador';
}

export default function Dashboard() {
  const [stats, setStats] = useState({ total: 0, stamped: 0, pending: 0, totalAmount: 0 });
  const [loading, setLoading] = useState(true);
  const [recentInvoices, setRecentInvoices] = useState([]);
  const toast = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [invoicesResponse] = await Promise.all([
        invoiceService.getInvoices({ limit: 5 }),
      ]);
      const invoices = invoicesResponse.data || invoicesResponse || [];
      setRecentInvoices(invoices);
      setStats({
        total: invoices.length,
        stamped: invoices.filter(i => i.uuid).length,
        pending: invoices.filter(i => !i.uuid).length,
        totalAmount: invoices.reduce((s, i) => s + (Number(i.total) || 0), 0),
      });
    } catch (err) {
      console.error('Error fetching data:', err);
      toast.error('No se pudieron cargar las facturas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Dashboard</h1>
          <p className="page-header__subtitle">Resumen de actividad reciente</p>
        </div>
        <div className="row">
          <Button variant="secondary" onClick={fetchData}>↻ Actualizar</Button>
          <Button variant="primary" onClick={() => (window.location.href = '/pos')}>+ Nueva venta</Button>
        </div>
      </div>

      <div className="kpi-grid">
        <Card padding="md" className="kpi">
          <div className="kpi__label">Total facturas</div>
          {loading ? <Skeleton width={80} height={28} /> : <div className="kpi__value">{stats.total}</div>}
          <div className="kpi__hint"><Badge tone="info">Periodo actual</Badge></div>
        </Card>
        <Card padding="md" className="kpi">
          <div className="kpi__label">Timbradas</div>
          {loading ? <Skeleton width={80} height={28} /> : <div className="kpi__value">{stats.stamped}</div>}
          <div className="kpi__hint"><Badge tone="success" icon="✓">Vigentes</Badge></div>
        </Card>
        <Card padding="md" className="kpi">
          <div className="kpi__label">Pendientes</div>
          {loading ? <Skeleton width={80} height={28} /> : <div className="kpi__value">{stats.pending}</div>}
          <div className="kpi__hint"><Badge tone="warning" icon="!">Por timbrar</Badge></div>
        </Card>
        <Card padding="md" className="kpi">
          <div className="kpi__label">Monto facturado</div>
          {loading ? <Skeleton width={120} height={28} /> : <div className="kpi__value mono">{formatMoney(stats.totalAmount)}</div>}
          <div className="kpi__hint"><Badge tone="neutral">MXN</Badge></div>
        </Card>
      </div>

      <div style={{ height: 24 }} />

      <Card
        title="Facturas recientes"
        subtitle="Últimas 5 facturas registradas"
        action={<Button variant="ghost" size="sm" onClick={() => (window.location.href = '/invoices')}>Ver todas →</Button>}
        padding="md"
      >
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="invoice-row">
                <Skeleton width="40%" height={14} />
                <Skeleton width="15%" height={14} />
                <Skeleton width="15%" height={14} />
                <Skeleton width="20%" height={20} radius={999} />
              </div>
            ))}
          </div>
        ) : recentInvoices.length === 0 ? (
          <EmptyState
            icon="📄"
            title="Aún no hay facturas"
            description="Las facturas timbradas desde el POS aparecerán aquí."
            action={<Button variant="primary" onClick={() => (window.location.href = '/pos')}>Ir al POS</Button>}
          />
        ) : (
          <div className="invoice-list">
            <div className="invoice-row invoice-row--head">
              <div>Folio / UUID</div>
              <div>Fecha</div>
              <div className="num">Total</div>
              <div>Estado</div>
            </div>
            {recentInvoices.map((inv) => (
              <div key={inv._id || inv.uuid || inv.folio} className="invoice-row">
                <div className="mono muted" title={inv.uuid || ''}>
                  {inv.uuid ? inv.uuid.slice(0, 18) + (inv.uuid.length > 18 ? '…' : '') : `Folio ${inv.folio || inv._id || '—'}`}
                </div>
                <div>{formatDate(inv.fecha)}</div>
                <div className="num mono">{formatMoney(inv.total)}</div>
                <div><Badge tone={invoiceTone(inv)}>{invoiceLabel(inv)}</Badge></div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
