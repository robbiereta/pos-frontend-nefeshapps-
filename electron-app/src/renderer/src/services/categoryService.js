// Category service — talks to /api/categories.
//
// Categories carry the SAT codes (claveProdServ, claveUnidad,
// unidad, objetoImp) that the CFDI needs. When the user creates
// or updates a product, the ProductModal pre-fills those fields
// from the chosen category; the backend then re-applies the
// inheritance at write time (so a category rename in admin
// doesn't accidentally mutate historical product SAT codes).
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

export const categoryService = {
  async list({ includeInactive = false } = {}) {
    const url = includeInactive
      ? `${API_URL}/api/categories?activo=all`
      : `${API_URL}/api/categories`;
    const res = await fetch(url, { headers: authHeader() });
    const json = await parseJson(res);
    return Array.isArray(json.data) ? json.data : [];
  },

  async create({ nombre, claveProdServ, claveUnidad, unidad, objetoImp = '02', tasaIVA = 0.16 }) {
    const res = await fetch(`${API_URL}/api/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ nombre, claveProdServ, claveUnidad, unidad, objetoImp, tasaIVA }),
    });
    const json = await parseJson(res);
    return json.data;
  },

  async update(id, patch) {
    const res = await fetch(`${API_URL}/api/categories/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify(patch),
    });
    const json = await parseJson(res);
    return json.data;
  },

  async deactivate(id) {
    const res = await fetch(`${API_URL}/api/categories/${id}`, {
      method: 'DELETE',
      headers: authHeader(),
    });
    const json = await parseJson(res);
    return json.data;
  },
};

export default categoryService;
