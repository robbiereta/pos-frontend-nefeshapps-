// Team management page — owner-only.
//
// Shows every member of the current tenant (including the owner)
// and lets the owner invite a new sub-user, change a member's role,
// or deactivate a member. Sub-users see the list read-only and the
// "Invite" form is hidden.
//
// The visual language follows the pwa admin identity already in
// use across the rest of the admin pages (page-title-hero, modern
// Button, status-pill, invoice-table).
import { useEffect, useState } from 'react';
import Button from '../components/ui/Button';
import { teamService } from '../services/teamService';

const ROLES = [
  { value: 'admin', label: 'Administrador', desc: 'Acceso total excepto gestión de equipo.' },
  { value: 'user',  label: 'Operador',      desc: 'POS y ventas. Sin páginas de administración.' },
  { value: 'viewer', label: 'Visor',        desc: 'Solo lectura. (Reservado para uso futuro.)' },
];

const readUser = () => {
  try { return JSON.parse(localStorage.getItem('user') || 'null'); }
  catch { return null; }
};

const initialForm = {
  fullName: '',
  email: '',
  username: '',
  password: '',
  role: 'user',
};

const statusPill = (member) => {
  if (member.isOwner) {
    return <span className="status-pill status-pill--active">Propietario</span>;
  }
  if (member.isActive) {
    return <span className="status-pill status-pill--active">Activo</span>;
  }
  return <span className="status-pill status-pill--inactive">Inactivo</span>;
};

const roleLabel = (role) => {
  if (role === 'owner') return 'Propietario';
  const found = ROLES.find((r) => r.value === role);
  return found ? found.label : role;
};

export default function Team() {
  const me = readUser();
  const isOwner = me?.role === 'owner' || me?.role === undefined;
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editRole, setEditRole] = useState('user');

  const fetchMembers = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await teamService.list();
      setMembers(Array.isArray(list) ? list : []);
    } catch (e) {
      setError(e.message || 'No se pudo cargar el equipo.');
      setMembers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMembers(); }, []);

  const onCreate = async (e) => {
    e.preventDefault();
    setFormError(null);
    if (!form.fullName || !form.email || !form.username || !form.password) {
      setFormError('Todos los campos son obligatorios.');
      return;
    }
    if (form.password.length < 6) {
      setFormError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    setSubmitting(true);
    try {
      await teamService.create(form);
      setForm(initialForm);
      setShowForm(false);
      await fetchMembers();
    } catch (e) {
      setFormError(e.data?.message || e.message || 'Error al crear el usuario.');
    } finally {
      setSubmitting(false);
    }
  };

  const onRoleChange = async (member) => {
    if (member.isOwner) return;
    try {
      await teamService.update(member._id, { role: editRole });
      setEditingId(null);
      await fetchMembers();
    } catch (e) {
      setError(e.data?.message || e.message);
    }
  };

  const onToggleActive = async (member) => {
    if (member.isOwner) return;
    const action = member.isActive ? 'desactivar' : 'reactivar';
    if (!window.confirm(`¿Seguro que quieres ${action} a ${member.fullName || member.email}?`)) return;
    try {
      await teamService.update(member._id, { isActive: !member.isActive });
      await fetchMembers();
    } catch (e) {
      setError(e.data?.message || e.message);
    }
  };

  return (
    <div className="team-page">
      <header className="page-title-hero">
        <div>
          <h1>Equipo</h1>
          <p>Usuarios que comparten este tenant. Cada uno entra con sus propias credenciales pero ve el mismo catálogo.</p>
        </div>
        {isOwner && (
          <Button variant="primary" onClick={() => setShowForm((s) => !s)}>
            {showForm ? 'Cancelar' : '+ Invitar usuario'}
          </Button>
        )}
      </header>

      {!isOwner && (
        <div className="info-banner">
          Solo el propietario del tenant puede invitar, cambiar roles o desactivar usuarios.
        </div>
      )}

      {error && (
        <div className="error-banner" role="alert">{error}</div>
      )}

      {isOwner && showForm && (
        <form className="team-form card" onSubmit={onCreate}>
          <h2>Invitar nuevo usuario</h2>
          <p className="form-help">
            Comparte catálogo, clientes, ventas y facturas contigo. El nuevo usuario entra con la contraseña que pongas aquí.
          </p>
          <div className="form-grid">
            <label>
              <span>Nombre completo</span>
              <input
                type="text"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder="Ana Cajera"
                required
              />
            </label>
            <label>
              <span>Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="ana@empresa.com"
                required
              />
            </label>
            <label>
              <span>Username</span>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="anacajera"
                required
              />
            </label>
            <label>
              <span>Contraseña</span>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
              />
            </label>
            <label>
              <span>Rol</span>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              <small className="form-help">{ROLES.find((r) => r.value === form.role)?.desc}</small>
            </label>
          </div>
          {formError && <div className="error-banner" role="alert">{formError}</div>}
          <div className="form-actions">
            <Button variant="secondary" onClick={() => { setShowForm(false); setForm(initialForm); setFormError(null); }}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting ? 'Creando…' : 'Crear usuario'}
            </Button>
          </div>
        </form>
      )}

      <section className="team-list">
        <h2>Miembros ({members.length})</h2>
        {loading ? (
          <p className="muted">Cargando…</p>
        ) : members.length === 0 ? (
          <p className="muted">Aún no hay usuarios en este tenant.</p>
        ) : (
          <table className="invoice-table data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Último acceso</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m._id} className={m.isActive ? '' : 'row-inactive'}>
                  <td>
                    <div className="member-name">
                      <strong>{m.fullName || m.username}</strong>
                      <small>@{m.username}</small>
                    </div>
                  </td>
                  <td>{m.email}</td>
                  <td>
                    {editingId === m._id ? (
                      <select
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value)}
                        onBlur={() => onRoleChange(m)}
                        autoFocus
                      >
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    ) : (
                      <span
                        className={m.isOwner ? '' : 'role-editable'}
                        onClick={() => {
                          if (!isOwner || m.isOwner) return;
                          setEditingId(m._id);
                          setEditRole(m.role);
                        }}
                      >
                        {roleLabel(m.role)}
                      </span>
                    )}
                  </td>
                  <td>{statusPill(m)}</td>
                  <td>
                    {m.lastLogin
                      ? new Date(m.lastLogin).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })
                      : '—'}
                  </td>
                  <td className="actions-cell">
                    {isOwner && !m.isOwner && (
                      <Button
                        variant={m.isActive ? 'danger' : 'secondary'}
                        size="sm"
                        onClick={() => onToggleActive(m)}
                      >
                        {m.isActive ? 'Desactivar' : 'Reactivar'}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
