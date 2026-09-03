// Ticket Designer — visual editor for the printed receipt.
//
// Layout:
//   ┌─────────────────────────────────────────────┐
//   │ page-title-hero  (header + Reset / Save)  │
//   ├──────────────────┬──────────────────────────┤
//   │ Editor (left)    │ Live preview (right)     │
//   │  - Header lines  │  scaled-down paper       │
//   │  - Columns       │  showing exactly what     │
//   │  - Totals        │  the printer would emit   │
//   │  - Payment       │                          │
//   │  - Footer        │                          │
//   │  - Styles + paper│                          │
//   └──────────────────┴──────────────────────────┘
//
// The preview uses a sample sale (3 items + payment) so the user
// can see the actual output. Saving persists via PUT
// /api/ticket-template.
import { useEffect, useState } from 'react';
import Button from '../components/ui/Button';
import { ticketTemplateService } from '../services/ticketTemplateService';
import { useToast } from '../components/ui/Toast.jsx';

const PAPER_WIDTHS = {
  '58mm': '58mm',
  '80mm': '80mm',
  'letter': '8.5in',
};

const SAMPLE_SALE = {
  folio: 'A-000123',
  fecha: new Date().toLocaleString('es-MX'),
  cliente: { nombre: 'Público en General', rfc: 'XAXX010101000' },
  items: [
    { cantidad: 2, nombre: 'Café Americano', precioUnitario: 35, importe: 70 },
    { cantidad: 1, nombre: 'Pan Dulce', precioUnitario: 18, importe: 18 },
    { cantidad: 1, nombre: 'Cappuccino', precioUnitario: 45, importe: 45 },
  ],
  subtotal: 115.83,
  iva: 18.53,
  total: 134.36,
  metodoPago: 'Efectivo',
  recibido: 200,
  cambio: 65.64,
};

const DEFAULTS = {
  header: { logo: '', lines: ['Negocio Demo', 'Av. Principal 123, Centro', 'Tel: 555-0100', 'RFC: DEMO000000000'] },
  itemsColumns: { showQty: true, showUnitPrice: true, showLineTotal: true, layout: 'separate' },
  totals: { showSubtotal: true, showTax: true, showTotal: true, taxLabel: 'IVA' },
  payment: { showMethod: true, showAmountReceived: false, showChange: false },
  footer: { lines: ['¡Gracias por su compra!', 'Devoluciones dentro de los 30 días con ticket.'], showCSD: false, showQR: false, showDateTime: true },
  styles: { fontFamily: 'mono', fontSize: 12, alignment: 'left', boldHeader: true },
  paperSize: '80mm',
};

const PRESET_HEADERS = [
  {
    label: 'Restaurante mexicano',
    values: {
      header: { logo: '', lines: ['Tacos Doña Mary', 'Av. Reforma 100, CDMX', 'Tel: 5555-1234', 'RFC: TAM950101AAA'] },
      footer: { lines: ['¡Buen provecho!', 'Síguenos en @tacosdonamary'], showCSD: false, showQR: true, showDateTime: true },
    },
  },
  {
    label: 'Tienda de abarrotes',
    values: {
      header: { logo: '', lines: ['Abarrotes Lupita', 'Calle Hidalgo 5, Local 2', 'Tel: 555-9876', 'RFC: ALU900303BBB'] },
      footer: { lines: ['¡Gracias por su preferencia!', 'Aceptamos todas las tarjetas.'], showCSD: true, showQR: true, showDateTime: true },
    },
  },
  {
    label: 'Servicios profesionales',
    values: {
      header: { logo: '', lines: ['Bufete Consultores SC', 'Insurgentes Sur 1234, Piso 5', 'Tel: 555-4321', 'RFC: BCO850909CCC'] },
      footer: { lines: ['Factura disponible en portal.', 'Soporte: contacto@bufete.mx'], showCSD: true, showQR: true, showDateTime: true },
    },
  },
];

const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;

export default function TicketDesigner() {
  const toast = useToast();
  const [tpl, setTpl] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await ticketTemplateService.get();
        if (!cancelled) setTpl(data || DEFAULTS);
      } catch (e) {
        if (!cancelled) setError(e.message || 'No se pudo cargar la plantilla.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const onChange = (section, key, value) => {
    setTpl((s) => ({
      ...s,
      [section]: { ...s[section], [key]: value },
    }));
  };

  const onHeaderLine = (idx, value) => {
    setTpl((s) => {
      const lines = [...(s.header?.lines || [])];
      lines[idx] = value;
      return { ...s, header: { ...s.header, lines } };
    });
  };
  const addHeaderLine = () => setTpl((s) => ({ ...s, header: { ...s.header, lines: [...(s.header?.lines || []), ''] } }));
  const removeHeaderLine = (idx) => setTpl((s) => ({ ...s, header: { ...s.header, lines: (s.header?.lines || []).filter((_, i) => i !== idx) } }));

  const onFooterLine = (idx, value) => {
    setTpl((s) => {
      const lines = [...(s.footer?.lines || [])];
      lines[idx] = value;
      return { ...s, footer: { ...s.footer, lines } };
    });
  };
  const addFooterLine = () => setTpl((s) => ({ ...s, footer: { ...s.footer, lines: [...(s.footer?.lines || []), ''] } }));
  const removeFooterLine = (idx) => setTpl((s) => ({ ...s, footer: { ...s.footer, lines: (s.footer?.lines || []).filter((_, i) => i !== idx) } }));

  const applyPreset = (preset) => {
    setTpl((s) => ({
      ...s,
      header: { ...s.header, ...preset.values.header },
      footer: { ...s.footer, ...preset.values.footer },
    }));
  };

  const onSave = async () => {
    setSaving(true);
    try {
      const data = await ticketTemplateService.update(tpl);
      setTpl(data);
      toast?.success?.('Plantilla guardada');
    } catch (e) {
      setError(e.message || 'No se pudo guardar la plantilla.');
    } finally {
      setSaving(false);
    }
  };

  const onReset = async () => {
    if (!window.confirm('¿Restaurar la plantilla a los valores predeterminados?')) return;
    try {
      const data = await ticketTemplateService.reset();
      setTpl(data);
      toast?.success?.('Plantilla restaurada');
    } catch (e) {
      setError(e.message);
    }
  };

  if (loading) {
    return <div className="ticket-designer"><p className="muted">Cargando…</p></div>;
  }

  return (
    <div className="ticket-designer">
      <header className="page-title-hero">
        <div>
          <h1>Diseñador de Ticket</h1>
          <p>Edita el formato del recibo impreso. Los cambios se guardan por tenant y se usan al imprimir ventas.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button variant="secondary" onClick={onReset}>Restablecer</Button>
          <Button variant="primary" onClick={onSave} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </header>

      {error && <div className="error-banner" role="alert">{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1.5rem' }}>
        {/* ─── Editor (left) ─────────────────────────────────────── */}
        <div className="card" style={cardStyle}>
          <h2 style={sectionH}>Plantillas listas</h2>
          <p className="muted" style={{ marginTop: '-0.25rem', fontSize: '0.85rem' }}>
            Punto de partida — después puedes afinar cualquier campo.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
            {PRESET_HEADERS.map((p) => (
              <Button key={p.label} variant="secondary" size="sm" onClick={() => applyPreset(p)}>
                {p.label}
              </Button>
            ))}
          </div>

          <h2 style={sectionH}>Header (líneas del negocio)</h2>
          {(tpl.header?.lines || []).map((line, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <input
                type="text"
                value={line}
                onChange={(e) => onHeaderLine(i, e.target.value)}
                placeholder={i === 0 ? 'Nombre del negocio' : 'Línea de información'}
                style={{ ...inputStyle, flex: 1 }}
              />
              <Button variant="ghost" size="sm" onClick={() => removeHeaderLine(i)}>✕</Button>
            </div>
          ))}
          <Button variant="secondary" size="sm" onClick={addHeaderLine}>+ Agregar línea</Button>

          <h2 style={sectionH}>Columnas de productos</h2>
          <div style={toggleRow}>
            <label><input type="checkbox" checked={tpl.itemsColumns?.showQty} onChange={(e) => onChange('itemsColumns', 'showQty', e.target.checked)} /> Mostrar cantidad</label>
            <label><input type="checkbox" checked={tpl.itemsColumns?.showUnitPrice} onChange={(e) => onChange('itemsColumns', 'showUnitPrice', e.target.checked)} /> Mostrar precio unitario</label>
            <label><input type="checkbox" checked={tpl.itemsColumns?.showLineTotal} onChange={(e) => onChange('itemsColumns', 'showLineTotal', e.target.checked)} /> Mostrar importe</label>
          </div>
          <label style={labelStyle}>
            <span>Disposición de columnas</span>
            <select value={tpl.itemsColumns?.layout || 'separate'} onChange={(e) => onChange('itemsColumns', 'layout', e.target.value)} style={inputStyle}>
              <option value="separate">Separadas (qty / desc / precio / total)</option>
              <option value="compact">Compacta (desc + precio)</option>
            </select>
          </label>

          <h2 style={sectionH}>Totales</h2>
          <div style={toggleRow}>
            <label><input type="checkbox" checked={tpl.totals?.showSubtotal} onChange={(e) => onChange('totals', 'showSubtotal', e.target.checked)} /> Subtotal</label>
            <label><input type="checkbox" checked={tpl.totals?.showTax} onChange={(e) => onChange('totals', 'showTax', e.target.checked)} /> {tpl.totals?.taxLabel || 'Impuesto'}</label>
            <label><input type="checkbox" checked={tpl.totals?.showTotal} onChange={(e) => onChange('totals', 'showTotal', e.target.checked)} /> Total</label>
          </div>
          <label style={labelStyle}>
            <span>Etiqueta del impuesto</span>
            <input type="text" value={tpl.totals?.taxLabel || 'IVA'} onChange={(e) => onChange('totals', 'taxLabel', e.target.value)} style={inputStyle} />
          </label>

          <h2 style={sectionH}>Pago</h2>
          <div style={toggleRow}>
            <label><input type="checkbox" checked={tpl.payment?.showMethod} onChange={(e) => onChange('payment', 'showMethod', e.target.checked)} /> Método de pago</label>
            <label><input type="checkbox" checked={tpl.payment?.showAmountReceived} onChange={(e) => onChange('payment', 'showAmountReceived', e.target.checked)} /> Monto recibido</label>
            <label><input type="checkbox" checked={tpl.payment?.showChange} onChange={(e) => onChange('payment', 'showChange', e.target.checked)} /> Cambio</label>
          </div>

          <h2 style={sectionH}>Footer</h2>
          {(tpl.footer?.lines || []).map((line, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <input type="text" value={line} onChange={(e) => onFooterLine(i, e.target.value)} placeholder="Línea del pie" style={{ ...inputStyle, flex: 1 }} />
              <Button variant="ghost" size="sm" onClick={() => removeFooterLine(i)}>✕</Button>
            </div>
          ))}
          <Button variant="secondary" size="sm" onClick={addFooterLine}>+ Agregar línea</Button>
          <div style={{ ...toggleRow, marginTop: '0.6rem' }}>
            <label><input type="checkbox" checked={tpl.footer?.showDateTime} onChange={(e) => onChange('footer', 'showDateTime', e.target.checked)} /> Mostrar fecha/hora</label>
            <label><input type="checkbox" checked={tpl.footer?.showCSD} onChange={(e) => onChange('footer', 'showCSD', e.target.checked)} /> Mostrar UUID CFDI</label>
            <label><input type="checkbox" checked={tpl.footer?.showQR} onChange={(e) => onChange('footer', 'showQR', e.target.checked)} /> Mostrar QR del CFDI</label>
          </div>

          <h2 style={sectionH}>Estilo y papel</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
            <label style={labelStyle}>
              <span>Tipografía</span>
              <select value={tpl.styles?.fontFamily || 'mono'} onChange={(e) => onChange('styles', 'fontFamily', e.target.value)} style={inputStyle}>
                <option value="mono">Monoespaciada (impresoras térmicas)</option>
                <option value="sans">Sans (Inter)</option>
              </select>
            </label>
            <label style={labelStyle}>
              <span>Tamaño</span>
              <input type="number" min="8" max="20" value={tpl.styles?.fontSize || 12} onChange={(e) => onChange('styles', 'fontSize', Number(e.target.value) || 12)} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              <span>Alineación</span>
              <select value={tpl.styles?.alignment || 'left'} onChange={(e) => onChange('styles', 'alignment', e.target.value)} style={inputStyle}>
                <option value="left">Izquierda</option>
                <option value="center">Centro</option>
                <option value="right">Derecha</option>
              </select>
            </label>
            <label style={labelStyle}>
              <span>Tamaño del papel</span>
              <select value={tpl.paperSize || '80mm'} onChange={(e) => setTpl((s) => ({ ...s, paperSize: e.target.value }))} style={inputStyle}>
                <option value="58mm">58 mm (térmica pequeña)</option>
                <option value="80mm">80 mm (térmica estándar)</option>
                <option value="letter">Carta (impresora normal)</option>
              </select>
            </label>
          </div>
        </div>

        {/* ─── Preview (right) ────────────────────────────────────── */}
        <div className="card" style={cardStyle}>
          <h2 style={sectionH}>Vista previa</h2>
          <p className="muted" style={{ marginTop: '-0.25rem', fontSize: '0.85rem' }}>
            Así se imprimirá una venta de ejemplo.
          </p>
          <TicketPreview tpl={tpl} sale={SAMPLE_SALE} />
        </div>
      </div>
    </div>
  );
}

function TicketPreview({ tpl, sale }) {
  const paperWidth = PAPER_WIDTHS[tpl.paperSize] || '80mm';
  const fontFamily = tpl.styles?.fontFamily === 'mono'
    ? 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
    : 'Inter, system-ui, sans-serif';
  const fontSize = `${tpl.styles?.fontSize || 12}px`;
  const textAlign = tpl.styles?.alignment || 'left';

  return (
    <div
      style={{
        background: '#fff',
        border: '1px dashed #94a3b8',
        padding: '1rem',
        fontFamily,
        fontSize,
        textAlign,
        lineHeight: 1.4,
        maxWidth: paperWidth,
        margin: '0 auto',
        color: '#0f172a',
      }}
    >
      {tpl.header?.logo && (
        <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
          <img src={tpl.header.logo} alt="logo" style={{ maxWidth: '60%', maxHeight: 80, objectFit: 'contain' }} />
        </div>
      )}
      {(tpl.header?.lines || []).filter(Boolean).map((line, i) => (
        <div key={i} style={{ fontWeight: tpl.styles?.boldHeader ? 600 : 400 }}>{line}</div>
      ))}

      <div style={{ borderTop: '1px dashed #94a3b8', margin: '0.5rem 0', paddingTop: '0.4rem' }}>
        {tpl.footer?.showDateTime && (
          <div style={{ fontSize: '0.9em', color: '#475569' }}>{sale.fecha}</div>
        )}
        <div style={{ fontSize: '0.9em', color: '#475569' }}>Ticket: {sale.folio}</div>
        <div style={{ fontSize: '0.9em', color: '#475569' }}>Cliente: {sale.cliente.nombre}</div>
      </div>

      <div style={{ borderTop: '1px dashed #94a3b8', paddingTop: '0.4rem' }}>
        {sale.items.map((it, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', marginBottom: '0.3rem' }}>
            <div>{it.nombre}</div>
            {tpl.itemsColumns?.layout === 'compact' ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9em' }}>
                <span>{tpl.itemsColumns?.showQty ? `${it.cantidad} × ${money(it.precioUnitario)}` : ''}</span>
                {tpl.itemsColumns?.showLineTotal && <span>{money(it.importe)}</span>}
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9em' }}>
                {tpl.itemsColumns?.showQty && <span>{it.cantidad}</span>}
                <span style={{ flex: 1, paddingLeft: '0.5rem' }}>{tpl.itemsColumns?.showUnitPrice ? money(it.precioUnitario) : ''}</span>
                {tpl.itemsColumns?.showLineTotal && <span>{money(it.importe)}</span>}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ borderTop: '1px dashed #94a3b8', paddingTop: '0.4rem', marginTop: '0.4rem' }}>
        {tpl.totals?.showSubtotal && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal</span><span>{money(sale.subtotal)}</span></div>
        )}
        {tpl.totals?.showTax && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{tpl.totals?.taxLabel || 'IVA'}</span><span>{money(sale.iva)}</span></div>
        )}
        {tpl.totals?.showTotal && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.05em' }}><span>TOTAL</span><span>{money(sale.total)}</span></div>
        )}
      </div>

      {tpl.payment?.showMethod && (
        <div style={{ borderTop: '1px dashed #94a3b8', paddingTop: '0.4rem', marginTop: '0.4rem' }}>
          <div>Pago: {sale.metodoPago}</div>
          {tpl.payment?.showAmountReceived && <div>Recibido: {money(sale.recibido)}</div>}
          {tpl.payment?.showChange && <div>Cambio: {money(sale.cambio)}</div>}
        </div>
      )}

      <div style={{ borderTop: '1px dashed #94a3b8', paddingTop: '0.4rem', marginTop: '0.4rem' }}>
        {(tpl.footer?.lines || []).filter(Boolean).map((line, i) => (
          <div key={i}>{line}</div>
        ))}
        {tpl.footer?.showCSD && (
          <div style={{ fontSize: '0.8em', color: '#475569', marginTop: '0.4rem' }}>
            UUID: A1B2C3D4-E5F6-7890-ABCD-EF1234567890
          </div>
        )}
        {tpl.footer?.showQR && (
          <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
            <div style={{
              display: 'inline-block', width: 60, height: 60,
              background: 'repeating-linear-gradient(45deg, #0f172a, #0f172a 3px, #fff 3px, #fff 6px)',
            }} />
            <div style={{ fontSize: '0.7em', color: '#94a3b8' }}>QR del CFDI</div>
          </div>
        )}
      </div>
    </div>
  );
}

const cardStyle = {
  padding: '1.5rem',
  background: 'var(--card-bg, #fff)',
  border: '1px solid var(--border-color, #e2e8f0)',
  borderRadius: 12,
  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
};
const sectionH = { fontSize: '1rem', margin: '1.25rem 0 0.5rem' };
const inputStyle = {
  padding: '0.5rem 0.7rem',
  border: '1px solid #cbd5e1',
  borderRadius: 8,
  fontSize: '0.9rem',
  background: '#fff',
};
const labelStyle = { display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.85rem', color: '#334155' };
const toggleRow = { display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.9rem', marginBottom: '0.6rem' };
