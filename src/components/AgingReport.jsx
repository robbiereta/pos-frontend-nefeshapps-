/**
 * Reporte de antigüedad de saldos.
 *
 * Props:
 *  - aging: objeto devuelto por notesService.getAging() o computeAgingClient()
 *  - title: string opcional
 */
export default function AgingReport({ aging, title = 'Antigüedad de Saldos' }) {
  if (!aging) return null;

  const formatMoney = (n) => `$${Number(n || 0).toFixed(2)}`;

  return (
    <div className="card" style={{ marginBottom: '1.5rem' }}>
      <h3 style={{ marginTop: 0, marginBottom: '0.85rem' }}>{title}</h3>

      <div className="aging-grid">
        {aging.buckets?.map((b) => {
          // Mapear keys con caracteres especiales a clases CSS-safe
          const classMap = {
            'vigente': 'vigente',
            '1-30': 'bucket-1-30',
            '31-60': 'bucket-31-60',
            '61-90': 'bucket-61-90',
            '90+': 'bucket-90plus',
          };
          return (
            <div key={b.key} className={`aging-bucket ${classMap[b.key] || ''}`}>
              <div className="label">{b.label}</div>
              <div className="amount">{formatMoney(b.amount)}</div>
              <div className="count">{b.count} {b.count === 1 ? 'nota' : 'notas'}</div>
            </div>
          );
        })}
      </div>

      <div style={{
        borderTop: '2px solid var(--gray-300, #d1d5db)',
        paddingTop: '0.65rem',
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '1.05rem',
        fontWeight: 700
      }}>
        <span>Total pendiente</span>
        <span style={{ color: '#ef4444' }}>{formatMoney(aging.total)}</span>
      </div>
    </div>
  );
}
