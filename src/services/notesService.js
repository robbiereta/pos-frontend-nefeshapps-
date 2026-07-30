// Servicio de Notas (CxC + CxP, sincronizado con nefapi-cfdis)
//
// Esta capa actúa como ADAPTADOR entre el modelo de UI (camelCase, status en
// inglés, métodos de pago como strings) y el modelo del backend (snake-ish
// español, status en español, códigos SAT).
//
// Despacha según `type`:
//   'receivable' → /api/notas-por-cobrar
//   'payable'    → /api/notas-por-pagar
//
// El campo de contacto es `clienteSnapshot` en CxC y `proveedorSnapshot` en
// CxP; en ambos casos el UI lo expone como `contactName` / `contactRfc`.
import { request } from './api';
import { clientService, invoiceService } from './api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5002';

const BASE_BY_TYPE = {
  receivable: '/api/notas-por-cobrar',
  payable:    '/api/notas-por-pagar',
};

function baseFor(type) {
  return BASE_BY_TYPE[type] || BASE_BY_TYPE.receivable;
}

// ClaveProdServ por defecto para CFDI PPD de una nota (genérica "otros
// servicios financieros"). El SAT acepta esta clave cuando el concepto
// realmente es un servicio financiero; si no, el operador puede cambiarlo
// más adelante ampliando el modelo de la nota.
const DEFAULT_CLAVE_PROD_SERV = '84111506';

// ──────────────────────────────────────────────────────────
// Catálogos de mapeo
// ──────────────────────────────────────────────────────────

// status backend (español) ⇄ status UI (inglés)
const STATUS_FROM_API = {
  pendiente: 'pending',
  parcial: 'partial',
  pagada: 'paid',
  vencida: 'overdue',
  cancelada: 'cancelled',
};
const STATUS_TO_API = {
  pending: 'pendiente',
  partial: 'parcial',
  paid: 'pagada',
  overdue: 'vencida',
  cancelled: 'cancelada',
};

// Métodos de pago UI ⇄ códigos SAT (catálogo c_FormaPago)
const METHOD_TO_SAT = {
  cash: '01',      // Efectivo
  check: '02',     // Cheque nominativo
  transfer: '03',  // Transferencia electrónica
  deposit: '03',   // Depósito (lo agrupamos como transferencia)
  card: '04',      // Tarjeta de crédito
  other: '99',     // Por definir
};
const SAT_TO_METHOD = {
  '01': 'cash',
  '02': 'check',
  '03': 'transfer',
  '04': 'card',
  '05': 'other',
  '06': 'other',
  '08': 'other',
  '12': 'other',
  '13': 'other',
  '14': 'other',
  '15': 'other',
  '17': 'other',
  '23': 'other',
  '24': 'other',
  '25': 'other',
  '26': 'other',
  '27': 'other',
  '28': 'card',    // Tarjeta de débito → la mostramos como "card"
  '29': 'card',    // Tarjeta de servicios
  '30': 'other',
  '31': 'other',
  '99': 'other',
};

// ──────────────────────────────────────────────────────────
// Mappers
// ──────────────────────────────────────────────────────────

function pickId(v) {
  if (!v) return null;
  if (typeof v === 'string') return v;
  return v._id || v.id || null;
}

function mapPaymentFromApi(p) {
  if (!p) return null;
  return {
    _id: p._id,
    amount: Number(p.monto || 0),
    date: p.fecha,
    method: SAT_TO_METHOD[p.metodoPago] || 'other',
    reference: p.referencia || '',
    notes: p.notas || '',
    registradoPor: pickId(p.registradoPor),
    createdAt: p.createdAt,
  };
}

function mapNoteFromApi(n) {
  if (!n) return null;

  const montoTotal = Number(n.montoTotal || 0);
  const montoAbonado = Number(n.montoAbonado || 0);
  const balanceFromVirtual = n.saldoPendiente != null ? Number(n.saldoPendiente) : null;
  const balance = balanceFromVirtual != null
    ? balanceFromVirtual
    : Math.max(montoTotal - montoAbonado, 0);

  // El snapshot puede venir como clienteSnapshot (CxC) o proveedorSnapshot (CxP)
  const snapshot = n.clienteSnapshot || n.proveedorSnapshot || {};
  // Inferimos type por la presencia del snapshot o del id de catálogo
  const type = n.clienteSnapshot !== undefined || n.clienteId !== undefined
    ? 'receivable'
    : 'payable';
  const contactId = pickId(n.clienteId) || pickId(n.proveedorId) || null;

  return {
    _id: n._id,
    type,
    folio: n.folio || '',
    amount: montoTotal,
    paidAmount: montoAbonado,
    balance,
    contactName: snapshot.nombre || '',
    contactRfc: snapshot.rfc || '',
    contactEmail: snapshot.email || '',
    contactPhone: snapshot.telefono || '',
    concept: n.concepto || '',
    description: n.descripcion || '',
    reference: n.invoiceUuid || n.folio || '',
    invoiceId: pickId(n.invoiceId),
    invoiceUuid: n.invoiceUuid || '',
    clienteId: contactId,
    proveedorId: contactId,
    issueDate: n.fechaEmision,
    dueDate: n.fechaVencimiento,
    notes: n.notas || '',
    status: STATUS_FROM_API[n.status] || 'pending',
    allowsPartial: n.permiteParcialidades !== false,
    payments: Array.isArray(n.abonos) ? n.abonos.map(mapPaymentFromApi).filter(Boolean) : [],
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
    cancelReason: n.motivoCancelacion || '',
  };
}

function mapNoteToApi(payload) {
  // payload viene en formato UI
  const out = {
    montoTotal: Number(payload.amount),
    fechaEmision: payload.issueDate || undefined,
    fechaVencimiento: payload.dueDate,
    concepto: payload.concept || '',
    descripcion: payload.description || '',
    notas: payload.notes || '',
    permiteParcialidades: payload.allowsPartial !== false,
  };
  const isPayable = payload.type === 'payable';
  // Si el caller ya resolvió un id de catálogo, lo mandamos con el nombre correcto
  const catalogId = payload.clienteId || payload.proveedorId;
  if (catalogId) {
    if (isPayable) out.proveedorId = catalogId;
    else          out.clienteId = catalogId;
  } else if (payload.contactName || payload.contactRfc) {
    const snapshot = {
      rfc: (payload.contactRfc || '').toUpperCase(),
      nombre: payload.contactName || '',
      email: payload.contactEmail || '',
      telefono: payload.contactPhone || '',
    };
    if (isPayable) out.proveedorSnapshot = snapshot;
    else          out.clienteSnapshot = snapshot;
  }
  return out;
}

function mapPaymentToApi(payload) {
  return {
    monto: Number(payload.amount),
    fecha: payload.date || undefined,
    metodoPago: METHOD_TO_SAT[payload.method] || '99',
    referencia: payload.reference || '',
    notas: payload.notes || '',
  };
}

// ──────────────────────────────────────────────────────────
// HTTP helper
// ──────────────────────────────────────────────────────────

async function http(method, endpoint, body) {
  return request(endpoint, {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

// ──────────────────────────────────────────────────────────
// Service
// ──────────────────────────────────────────────────────────

export const notesService = {
  /**
   * Listar notas. `type` despacha al endpoint correcto:
   *   'receivable' → /api/notas-por-cobrar
   *   'payable'    → /api/notas-por-pagar
   *
   * Filtros: status, contactId, q, fechaInicio, fechaFin, page, limit
   */
  getNotes: async ({ type = 'receivable', status, contactId, q, fechaInicio, fechaFin, page, limit } = {}) => {
    const params = {};
    if (status && STATUS_TO_API[status]) params.status = STATUS_TO_API[status];
    if (contactId) {
      // El nombre del param depende del tipo: clienteId / proveedorId
      params[type === 'payable' ? 'proveedorId' : 'clienteId'] = contactId;
    }
    if (page) params.page = page;
    if (limit) params.limit = limit;
    if (q) params.q = q;
    // fechaInicio/fechaFin los ignoramos por ahora (backend no los acepta como ISO directo)

    const query = new URLSearchParams(params).toString();
    const res = await http('GET', `${baseFor(type)}${query ? `?${query}` : ''}`);
    const list = (res.data || []).map(mapNoteFromApi);
    // Forzamos el type (a veces el mapper no puede inferirlo)
    list.forEach(n => { n.type = type; });
    return {
      data: list,
      pagination: res.pagination,
    };
  },

  getNoteById: async (id, type = 'receivable') => {
    const res = await http('GET', `${baseFor(type)}/${id}`);
    return mapNoteFromApi(res.data || res);
  },

  createNote: async (payload) => {
    const type = payload.type || 'receivable';
    const res = await http('POST', baseFor(type), mapNoteToApi(payload));
    return mapNoteFromApi(res.data || res);
  },

  updateNote: async (id, payload) => {
    // El backend solo permite editar: fechaVencimiento, concepto, descripcion,
    // permiteParcialidades, notas. No se puede cambiar monto si hay abonos.
    const type = payload.type || 'receivable';
    const body = {};
    if (payload.dueDate) body.fechaVencimiento = payload.dueDate;
    if (payload.concept !== undefined) body.concepto = payload.concept;
    if (payload.description !== undefined) body.descripcion = payload.description;
    if (payload.notes !== undefined) body.notas = payload.notes;
    if (payload.allowsPartial !== undefined) body.permiteParcialidades = !!payload.allowsPartial;
    const res = await http('PUT', `${baseFor(type)}/${id}`, body);
    return mapNoteFromApi(res.data || res);
  },

  cancelNote: async (id, motivo = 'Cancelada desde POS', type = 'receivable') => {
    const res = await http('POST', `${baseFor(type)}/${id}/cancelar`, { motivo });
    return mapNoteFromApi(res.data || res);
  },

  // El backend no expone GET /:id/payments; los abonos vienen embebidos
  // en el detalle de la nota. Devolvemos la lista mapeada.
  // type es opcional: si la nota ya trae `type` (de la lista), lo usamos;
  // si no, probamos primero cobrar y luego pagar.
  getPayments: async (noteId, type) => {
    let note = null;
    if (type) {
      note = await notesService.getNoteById(noteId, type);
    } else {
      try { note = await notesService.getNoteById(noteId, 'receivable'); }
      catch (_) { note = await notesService.getNoteById(noteId, 'payable'); }
    }
    return note?.payments || [];
  },

  addPayment: async (noteId, paymentData, type = 'receivable') => {
    const res = await http('POST', `${baseFor(type)}/${noteId}/abonos`, mapPaymentToApi(paymentData));
    return mapNoteFromApi(res.data || res);
  },

  deletePayment: async (noteId, paymentId, type = 'receivable') => {
    const res = await http('DELETE', `${baseFor(type)}/${noteId}/abonos/${paymentId}`);
    return mapNoteFromApi(res.data || res);
  },

  /**
   * Timbra un CFDI PPD (Pago en Parcialidades o Diferido) vinculado a la nota
   * usando los endpoints existentes:
   *   1) POST /api/invoices/client  → construye el JSON del CFDI
   *   2) POST /api/invoices/timbra  → lo timbra contra SW.com.mx
   *   3) PUT  /api/notas-por-cobrar/:id → guarda el UUID en la nota
   *
   * Devuelve { note, invoice } con la nota ya actualizada y los datos del
   * CFDI timbrado (uuid, fechaTimbrado, etc.).
   */
  timbrarPPD: async (noteId, opts = {}) => {
    const type = opts.type || 'receivable';
    if (type !== 'receivable') {
      throw new Error('El timbrado PPD solo aplica a notas por cobrar');
    }

    // 1) Traer la nota (versión fresca)
    const note = await notesService.getNoteById(noteId, type);
    if (!note) throw new Error('Nota no encontrada');
    if (note.invoiceUuid) {
      throw new Error('Esta nota ya tiene un CFDI timbrado (UUID: ' + note.invoiceUuid + ')');
    }
    if (note.status === 'cancelada') {
      throw new Error('No se puede timbrar una nota cancelada');
    }
    if (note.status === 'pagada') {
      throw new Error('La nota ya está pagada; no requiere CFDI');
    }

    // 2) Resolver datos del receptor.
    //    Prioridad: opts.receptor (override manual) > cliente del catálogo > snapshot
    let receptor = opts.receptor || null;
    if (!receptor) {
      if (note.clienteId) {
        try {
          const c = await clientService.getClientById(note.clienteId);
          receptor = {
            rfc: c.rfc,
            nombre: c.nombre,
            regimenFiscal: c.regimenFiscal || '616',
            domicilioFiscalReceptor: c.codigoPostal || '',
            usoCFDI: c.usoCFDI || 'G03',
            email: c.email || '',
          };
        } catch (e) {
          // cae al snapshot
        }
      }
      if (!receptor) {
        receptor = {
          rfc: note.contactRfc || 'XAXX010101000',
          nombre: note.contactName || 'PUBLICO EN GENERAL',
          regimenFiscal: opts.regimenFiscal || '616',
          domicilioFiscalReceptor: opts.domicilioFiscalReceptor || '',
          usoCFDI: opts.usoCFDI || 'G03',
          email: note.contactEmail || '',
        };
      }
    }

    // 3) Construir el CFDI (factura de cliente, MetodoPago = PPD)
    //    Una sola partida con el concepto y monto de la nota.
    const puSinIva = Number(note.amount) / 1.16;
    const iva = Number(note.amount) - puSinIva;
    const buildBody = {
      folio: note.folio,                     // el folio NPC-XXXXXX como folio del CFDI
      receptorRfc: receptor.rfc,
      receptorNombre: receptor.nombre,
      receptorRegimen: receptor.regimenFiscal,
      DomicilioFiscalReceptor: receptor.domicilioFiscalReceptor,
      UsoCFDI: receptor.usoCFDI,
      MetodoPago: 'PPD',                     // clave para que sea PPD
      formaPago: opts.formaPago || '99',     // 99 = Por definir (válido en PPD)
      notasPartidas: [
        {
          pu: Number(note.amount),           // precio CON IVA
          cantidad: 1,
          Descripcion: note.concept || `Nota por cobrar ${note.folio}`,
          CodigoSat: opts.claveProdServ || DEFAULT_CLAVE_PROD_SERV,
          ClaveUnidad: 'E48',
          Unidad: 'Servicio',
        },
      ],
    };
    const buildRes = await invoiceService.generateClient(buildBody);
    const invoiceJson = buildRes?.data || buildRes;

    // 4) Timbrar
    const stampRes = await invoiceService.stampInvoice({ invoiceData: invoiceJson });
    const stampData = stampRes?.data?.data || stampRes?.data || stampRes;
    const uuid = stampData?.uuid || stampData?.data?.uuid;
    if (!uuid) {
      // El backend respondió pero sin UUID: probablemente error de SW.com.mx
      const msg = stampData?.message || stampData?.messageDetail || 'SW.com.mx no devolvió UUID';
      const detail = stampData?.messageDetail || stampData?.data?.messageDetail;
      throw new Error(`Error al timbrar: ${msg}${detail ? ' — ' + detail : ''}`);
    }

    // 5) Ligar el UUID de vuelta a la nota
    const updatedNote = await notesService.updateNote(noteId, {
      type,
      invoiceUuid: uuid,
      // invoiceId lo asignará el backend cuando persista el CFDI
    });

    return { note: updatedNote, invoice: stampData };
  },

  /**
   * Antigüedad de saldos. Usa /summary del backend y, si hace falta detalle por
   * bucket, lo calcula client-side con computeAgingClient sobre la lista.
   */
  getAging: async (type = 'receivable') => {
    try {
      const res = await http('GET', `${baseFor(type)}/summary`);
      const data = res.data || {};
      let notes = [];
      try {
        const list = await notesService.getNotes({ type, limit: 500 });
        notes = list.data || [];
      } catch (_) {
        notes = [];
      }
      const computed = computeAgingClient(notes);
      if (data.totales) {
        computed.total = Number(data.totales.saldo || computed.total);
      }
      return computed;
    } catch (err) {
      // Fallback: cliente-side puro
      const list = await notesService.getNotes({ type, limit: 500 });
      return computeAgingClient(list.data || []);
    }
  },
};

// ──────────────────────────────────────────────────────────
// Cálculo de antigüedad client-side
// ──────────────────────────────────────────────────────────

const BUCKETS = [
  { key: 'vigente', label: 'Vigente',  min: -Infinity, max: 0 },
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
  return Math.floor((today - due) / (1000 * 60 * 60 * 24));
}

export function computeAgingClient(notes) {
  const result = {
    total: 0,
    buckets: BUCKETS.map(b => ({ ...b, amount: 0, count: 0 })),
    notes: [],
  };

  for (const note of notes) {
    const balance = Number(note.balance ?? (note.amount - (note.paidAmount || 0))) || 0;
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

export { API_URL, STATUS_FROM_API, STATUS_TO_API, METHOD_TO_SAT, SAT_TO_METHOD };
