// Categories management page — admin/owner only.
//
// Each category carries the SAT codes (claveProdServ, claveUnidad,
// unidad, objetoImp, tasaIVA) that the CFDI requires. When the
// admin creates or updates a product, those fields are inherited
// from the chosen category — see ProductModal for the UX.
//
// Visual identity matches the rest of the admin: page-title-hero,
// modern Button, invoice-table, status-pill.
import { useEffect, useState } from 'react';
import Button from '../components/ui/Button';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { categoryService } from '../services/categoryService';

const OBJETO_IMP_OPTIONS = [
  { value: '01', label: '01 — No objeto de impuesto' },
  { value: '02', label: '02 — Sí objeto' },
  { value: '03', label: '03 — Sí objeto y no obligado' },
];

const initialForm = {
  nombre: '',
  claveProdServ: '',
  claveUnidad: '',
  unidad: '',
  objetoImp: '02',
  tasaIVA: 0.16,
};

const statusPill = (cat) => {
  if (cat.activo) {
    return <span className="status-pill status-pill--active">Activa</span>;
  }
  return <span className="status-pill status-pill--inactive">Inactiva</span>;
};

export default function Categories() {
  const { isAdmin } = useCurrentUser();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [editingId, setEditingId] = useState(null);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await categoryService.list({ includeInactive: isAdmin });
      setCategories(Array.isArray(list) ? list : []);
    } catch (e) {
      setError(e.message || 'No se pudo cargar las categorías.');
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [isAdmin]);

  const onCreate = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!form.nombre || !form.claveProdServ || !form.claveUnidad || !form.unidad) {
      setFormError('Todos los campos son obligatorios.');
      return;
    }
    if (!/^\d{8}$/.test(form.claveProdServ)) {
      setFormError('La clave SAT del producto debe tener 8 dígitos.');
      return;
    }

    setSubmitting(true);
    try {
      await categoryService.create({
        ...form,
        tasaIVA: Number(form.tasaIVA) || 0,
      });
      setForm(initialForm);
      setShowForm(false);
      await fetchAll();
    } catch (e) {
      setFormError(e.data?.message || e.message || 'Error al crear la categoría.');
    } finally {
      setSubmitting(false);
    }
  };

  const onToggleActive = async (cat) => {
    const action = cat.activo ? 'desactivar' : 'reactivar';
    if (!window.confirm(`¿Seguro que quieres ${action} la categoría "${cat.nombre}"?`)) return;
    try {
      await categoryService.update(cat._id, { activo: !cat.activo });
      await fetchAll();
    } catch (e) {
      setError(e.data?.message || e.message);
    }
  };

  const startEdit = (cat) => {
    setEditingId(cat._id);
    setForm({
      nombre: cat.nombre,
      claveProdServ: cat.claveProdServ,
      claveUnidad: cat.claveUnidad,
      unidad: cat.unidad,
      objetoImp: cat.objetoImp,
      tasaIVA: cat.tasaIVA,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(initialForm);
  };

  return (
    <div className="categories-page">
      <header className="page-title-hero">
        <div>
          <h1>Categorías</h1>
          <p>
            Cada categoría lleva los códigos SAT (producto, unidad, objeto de impuesto) que
            el CFDI requiere. Al crear o editar un producto y asignarle una categoría, esos
            campos se copian automáticamente.
          </p>
        </div>
        {isAdmin && (
          <Button variant="primary" onClick={() => { setShowForm((s) => !s); cancelEdit(); }}>
            {showForm ? 'Cancelar' : '+ Nueva categoría'}
          </Button>
        )}
      </header>

      {!isAdmin && (
        <div className="info-banner">
          Solo el propietario del tenant o un administrador pueden crear, editar o desactivar categorías.
        </div>
      )}

      {error && <div className="error-banner" role="alert">{error}</div>}

      {isAdmin && showForm && (
        <form className="card" onSubmit={onCreate} style={{
          padding: '1.5rem',
          display: 'flex', flexDirection: 'column', gap: '1rem',
          background: 'var(--card-bg, #fff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>
            {editingId ? 'Editar categoría' : 'Nueva categoría'}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
            <label style={labelStyle}>
              <span>Nombre</span>
              <input
                type="text"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Bebidas"
                style={inputStyle}
                required
              />
            </label>
            <label style={labelStyle}>
              <span>Clave SAT producto (8 dígitos)</span>
              <input
                type="text"
                value={form.claveProdServ}
                onChange={(e) => setForm({ ...form, claveProdServ: e.target.value })}
                placeholder="01010101"
                pattern="[0-9]{8}"
                maxLength={8}
                style={inputStyle}
                required
              />
            </label>
            <label style={labelStyle}>
              <span>Clave SAT unidad</span>
              <input
                type="text"
                value={form.claveUnidad}
                onChange={(e) => setForm({ ...form, claveUnidad: e.target.value.toUpperCase() })}
                placeholder="E48"
                style={inputStyle}
                required
              />
            </label>
            <label style={labelStyle}>
              <span>Unidad (texto)</span>
              <input
                type="text"
                value={form.unidad}
                onChange={(e) => setForm({ ...form, unidad: e.target.value })}
                placeholder="Pieza"
                style={inputStyle}
                required
              />
            </label>
            <label style={labelStyle}>
              <span>Objeto de impuesto</span>
              <select
                value={form.objetoImp}
                onChange={(e) => setForm({ ...form, objetoImp: e.target.value })}
                style={inputStyle}
              >
                {OBJETO_IMP_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label style={labelStyle}>
              <span>Tasa de IVA (0 a 1)</span>
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={form.tasaIVA}
                onChange={(e) => setForm({ ...form, tasaIVA: e.target.value })}
                style={inputStyle}
              />
            </label>
          </div>
          {formError && <div className="error-banner" role="alert">{formError}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <Button variant="secondary" onClick={cancelEdit}>Cancelar</Button>
            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting ? 'Guardando…' : (editingId ? 'Guardar cambios' : 'Crear categoría')}
            </Button>
          </div>
        </form>
      )}

      <section style={{ marginTop: '0.5rem' }}>
        <h2 style={{ fontSize: '1.05rem', margin: '0 0 0.5rem' }}>Mis categorías ({categories.length})</h2>
        {loading ? (
          <p className="muted">Cargando…</p>
        ) : categories.length === 0 ? (
          <p className="muted">Aún no hay categorías en este tenant.</p>
        ) : (
          <table className="invoice-table data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Clave SAT</th>
                <th>Unidad</th>
                <th>Objeto Imp.</th>
                <th>Tasa IVA</th>
                <th>Estado</th>
                {isAdmin && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c._id} className={c.activo ? '' : 'row-inactive'}>
                  <td><strong>{c.nombre}</strong></td>
                  <td><code>{c.claveProdServ}</code></td>
                  <td>{c.unidad} <small style={{ color: '#94a3b8' }}>({c.claveUnidad})</small></td>
                  <td>{c.objetoImp}</td>
                  <td>{(c.tasaIVA * 100).toFixed(0)}%</td>
                  <td>{statusPill(c)}</td>
                  {isAdmin && (
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <Button
                        variant={c.activo ? 'danger' : 'secondary'}
                        size="sm"
                        onClick={() => onToggleActive(c)}
                      >
                        {c.activo ? 'Desactivar' : 'Reactivar'}
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

const labelStyle = {
  display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.85rem', color: '#334155',
};
const inputStyle = {
  padding: '0.5rem 0.7rem',
  border: '1px solid #cbd5e1',
  borderRadius: 8,
  fontSize: '0.9rem',
  background: '#fff',
};
