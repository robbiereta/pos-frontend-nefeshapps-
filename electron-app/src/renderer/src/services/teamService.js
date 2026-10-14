// Team management service — talks to /api/auth/team.
//
// Owner-only CRUD for sub-users that share the caller's tenant.
// Sub-users can read the list (so the Settings page can show the
// current team) but the role gates on the backend already restrict
// the destructive actions.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5002';

const authHeader = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

async function parseJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data.message || data.error || `HTTP ${response.status}`);
    err.status = response.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const teamService = {
  async list() {
    const res = await fetch(`${API_URL}/api/auth/team`, { headers: authHeader() });
    const json = await parseJson(res);
    return json.data || [];
  },

  async create({ username, email, password, fullName, role }) {
    const res = await fetch(`${API_URL}/api/auth/team`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ username, email, password, fullName, role }),
    });
    const json = await parseJson(res);
    return json.data;
  },

  async update(id, { role, isActive, fullName }) {
    const res = await fetch(`${API_URL}/api/auth/team/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ role, isActive, fullName }),
    });
    const json = await parseJson(res);
    return json.data;
  },

  async deactivate(id) {
    const res = await fetch(`${API_URL}/api/auth/team/${id}`, {
      method: 'DELETE',
      headers: authHeader(),
    });
    const json = await parseJson(res);
    return json.data;
  },
};

export default teamService;
