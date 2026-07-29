// Servicio de Notas por Cobrar / por Pagar
// Endpoints asumidos (REST estándar) — ajustar PATHS_BASE si difieren en nefapi-cfdis
import { request } from './api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5002';

// ⚠️ Si en nefapi-cfdis tus rutas son distintas, cambia solo este objeto.
// Convenciones alternativas esperadas:
//   - /api/notes-receivable + /api/notes-payable (rutas separadas)
//   - /api/notas/cobrar  + /api/notas/pagar     (español)
//   - /api/cxc + /api/cxp                      (siglas)
const PATHS_BASE = '/api/notes';

function buildPath(id) {
  return `${PATHS_BASE}/${id}`;
}

function buildPaymentsPath(id) {
  return `${PATHS_BASE}/${id}/payments`;
}

function buildPaymentPath(id, paymentId) {
  return `${PATHS_BASE}/${id}/payments/${paymentId}`;
}

// Helper: el request helper de api.js centraliza auth, JSON, errores
// Re-exportamos usando request importado arriba
async function http(method, endpoint, body) {
  return request(endpoint, {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export const notesService = {
  // ──────────────────────────────────────────────────────────
  // CRUD Notas
  // ──────────────────────────────────────────────────────────

  /**
   * Listar notas. type: 'receivable' | 'payable'.
   * Filtros opcionales: status, contactId, q (búsqueda), fechaInicio, fechaFin
   */
  getNotes: async ({ type, ...filters } = {}) => {
    const params = { ...filters };
    if (type) params.type = type;
    const query = new URLSearchParams(params).toString();
    const res = await http('GET', `${PATHS_BASE}${query ? `?${query}` : ''}`);
    return {
      ...res,
      data: res.data || [],
    };
  },

  getNoteById: async (id) => {
    const res = await http('GET', buildPath(id));
    return res.data || res;
  },

  createNote: async (noteData) => {
    return http('POST', PATHS_BASE, noteData);
  },

  updateNote: async (id, noteData) => {
    return http('PUT', buildPath(id), noteData);
  },

  cancelNote: async (id) => {
    // Cancelar = soft delete. Si tu backend usa DELETE directo, lo cambiamos.
    return http('DELETE', buildPath(id));
  },

  // ──────────────────────────────────────────────────────────
  // Abonos / Pagos
  // ──────────────────────────────────────────────────────────

  getPayments: async (noteId) => {
    const res = await http('GET', buildPaymentsPath(noteId));
    return res.data || [];
  },

  addPayment: async (noteId, paymentData) => {
    return http('POST', buildPaymentsPath(noteId), paymentData);
  },

  deletePayment: async (noteId, paymentId) => {
    return http('DELETE', buildPaymentPath(noteId, paymentId));
  },

  // ──────────────────────────────────────────────────────────
  // Antigüedad de saldos (Aging)
  // Devuelve buckets: vigente, 1-30, 31-60, 61-90, 90+
  // Si el backend no tiene /aging, calculamos client-side con getNotes
  // ──────────────────────────────────────────────────────────

  getAging: async (type) => {
    try {
      const res = await http('GET', `${PATHS_BASE}/aging?type=${type}`);
      return res.data || res;
    } catch (err) {
      // Fallback client-side
      const list = await notesService.getNotes({ type, status: 'pending' });
      return computeAgingClient(list.data || []);
    }
  },
};

// ──────────────────────────────────────────────────────────
// Cálculo de antigüedad client-side (fallback)
// ──────────────────────────────────────────────────────────

const BUCKETS = [
  { key: 'vigente', label: 'Vigente', min: -Infinity, max: 0 },
  { key: '1-30',    label: '1-30 días',   min: 1,   max: 30 },
  { key: '31-60',   label: '31-60 días',  min: 31,  max: 60 },
  { key: '61-90',   label: '61-90 días',  min: 61,  max: 90 },
  { key: '90+',     label: '90+ días',    min: 91,  max: Infinity },
];

function daysOverdue(dueDate) {
  if (!dueDate) return 0;
  const due = new Date(dueDate);
  if (isNaN(due.getTime())) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diff = Math.floor((today - due) / (1000 * 60 * 60 * 24));
  return diff;
}

export function computeAgingClient(notes) {
  const result = {
    total: 0,
    buckets: BUCKETS.map(b => ({ ...b, amount: 0, count: 0 })),
    notes: [],
  };

  for (const note of notes) {
    const balance = Number(note.balance ?? note.amount - (note.paidAmount || 0)) || 0;
    if (balance <= 0) continue;
    if (note.status === 'paid' || note.status === 'cancelled') continue;

    const days = daysOverdue(note.dueDate);
    const bucket = BUCKETS.find(b => days >= b.min && days <= b.max);
    if (!bucket) continue;

    const b = result.buckets.find(x => x.key === bucket.key);
    if (b) {
      b.amount += balance;
      b.count += 1;
    }
    result.total += balance;
    result.notes.push({ ...note, daysOverdue: days, bucket: bucket.key });
  }

  return result;
}

export { API_URL };
