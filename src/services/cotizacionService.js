/**
 * Servicio de Cotizaciones.
 * Habla con /api/cotizaciones del backend nefapi-cfdis.
 */
import { productService } from './productService';

const ESTADOS = ['borrador', 'enviada', 'aceptada', 'rechazada', 'vencida', 'facturada'];

export const cotizacionService = {
  // Listar cotizaciones (paginado + filtros)
  list: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return productService.request(`/api/cotizaciones${query ? `?${query}` : ''}`);
  },

  // Obtener una cotización
  get: async (id) => {
    return productService.request(`/api/cotizaciones/${id}`);
  },

  // Crear
  create: async (data) => {
    return productService.request('/api/cotizaciones', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Actualizar (solo en borrador)
  update: async (id, data) => {
    return productService.request(`/api/cotizaciones/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  // Eliminar (soft)
  remove: async (id) => {
    return productService.request(`/api/cotizaciones/${id}`, { method: 'DELETE' });
  },

  // Acciones de estado
  enviar:    (id, opts = {}) => productService.request(`/api/cotizaciones/${id}/enviar`,    { method: 'POST', body: JSON.stringify(opts) }),
  aceptar:   (id)              => productService.request(`/api/cotizaciones/${id}/aceptar`,   { method: 'POST' }),
  rechazar:  (id)              => productService.request(`/api/cotizaciones/${id}/rechazar`,  { method: 'POST' }),
  convertir: (id)              => productService.request(`/api/cotizaciones/${id}/convertir`, { method: 'POST' }),

  // PDF URL (para descargar)
  pdfUrl: (id) => {
    const base = import.meta.env.VITE_API_URL || 'http://localhost:5002';
    return `${base}/api/cotizaciones/${id}/pdf`;
  },

  // Stats
  stats: () => productService.request('/api/cotizaciones/stats'),

  ESTADOS,
};

export default cotizacionService;
