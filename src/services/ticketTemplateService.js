// Ticket template service — talks to /api/ticket-template.
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

export const ticketTemplateService = {
  async get() {
    const res = await fetch(`${API_URL}/api/ticket-template`, { headers: authHeader() });
    const json = await parseJson(res);
    return json.data;
  },

  async update(template) {
    const res = await fetch(`${API_URL}/api/ticket-template`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify(template),
    });
    const json = await parseJson(res);
    return json.data;
  },

  async reset() {
    const res = await fetch(`${API_URL}/api/ticket-template/reset`, {
      method: 'POST',
      headers: authHeader(),
    });
    const json = await parseJson(res);
    return json.data;
  },
};

export default ticketTemplateService;
