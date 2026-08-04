const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5002';


export async function request(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  let data;
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    data = await response.json();
  } else {
    const text = await response.text();
    throw new Error(`Expected JSON but got ${contentType || 'text'}: ${text.substring(0, 100)}`);
  }

  if (!response.ok) {
    throw new Error(data.message || `Request failed with status ${response.status}`);
  }
  return data;
}

export const authService = {
  login: async (email, password) => {
    const data = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: email, password }),
    });
    if (data.data?.accessToken) {
      localStorage.setItem('token', data.data.accessToken);
      localStorage.setItem('refreshToken', data.data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.data.user));
    }
    return data;
  },
  register: async (userData) => {
    const data = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    if (data.data?.accessToken) {
      localStorage.setItem('token', data.data.accessToken);
      localStorage.setItem('refreshToken', data.data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.data.user));
    }
    return data;
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  },
  getCurrentUser: () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },
  isAuthenticated: () => !!localStorage.getItem('token'),
};

export const invoiceService = {
  getInvoices: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/api/invoices?limit=100&page=1${query ? `&${query}` : ''}`).then(response => ({
      ...response,
      data: response.data || []
    }));
  },
  getInvoiceById: async (id) => {
    return request(`/api/invoices/${id}`).then(response => response.data);
  },
  generateGlobal: async (data) => {
    return request('/api/invoices/global', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  generateClient: async (data) => {
    return request('/api/invoices/client', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  generateIsrRetention: async (data) => {
    return request('/api/invoices/retencion-isr', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  stampInvoice: async (data) => {
    return request('/api/invoices/timbra', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  generatePDF: async (invoiceJsonOrXmlOrUuid) => {
    const token = localStorage.getItem('token');

    let payload;

    if (typeof invoiceJsonOrXmlOrUuid === 'string') {
      if (invoiceJsonOrXmlOrUuid.includes('<')) {
        // XML string
        payload = { cfdi: invoiceJsonOrXmlOrUuid };
      } else if (invoiceJsonOrXmlOrUuid.includes('{')) {
        // JSON string
        try {
          payload = JSON.parse(invoiceJsonOrXmlOrUuid);
          // If it has invoiceJson key, extract it
          if (payload.invoiceJson) {
            payload = { invoiceJson: payload.invoiceJson };
          }
        } catch (e) {
          // Assume it's a UUID if not valid JSON
          payload = { uuid: invoiceJsonOrXmlOrUuid };
        }
      } else {
        // UUID
        payload = { uuid: invoiceJsonOrXmlOrUuid };
      }
    } else {
      // Object - assume it's invoice JSON
      payload = { invoiceJson: invoiceJsonOrXmlOrUuid };
    }

    return fetch(`${API_URL}/api/invoices/pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    }).then(response => {
      if (response.ok) {
        return response.blob().then(blob => {
          return URL.createObjectURL(blob);
        });
      }
      throw new Error(`PDF generation failed: ${response.status}`);
    });
  },
};


export const salesService = {
  createSale: async (saleData) => {
    return request('/api/sales', {
      method: 'POST',
      body: JSON.stringify(saleData),
    });
  },
  getAllSales: async (params = { limit: 50, page: 1 }) => {
    const query = new URLSearchParams(params).toString();
    return request(`/api/sales?${query}`).then(response => response.data.sales);
  },
  getSaleById: async (id) => {
    return request(`/api/sales/${id}`);
  },
  updateSaleStatus: async (id, status, notes = '') => {
    return request(`/api/sales/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, notes }),
    });
  },
  getSalesStats: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/api/sales/stats${query ? `?${query}` : ''}`);
  },
  searchSales: async (query, field = 'folio') => {
    return request(`/api/sales/search?q=${encodeURIComponent(query)}&field=${field}`);
  },
  deleteSale: async (id) => {
    return request(`/api/sales/${id}`, {
      method: 'DELETE',
    });
  },
};

export const userService = {
  getCurrentUser: async () => {
    return request('/api/users/me');
  },
  getEmisorConfig: async () => {
    return request('/api/users/me/emisor-config');
  },
  updateEmisorConfig: async (config) => {
    return request('/api/users/me/emisor-config', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  },
};

export const cashDrawerService = {
  saveCutoff: async (cutoffData) => {
    return request('/api/cash-drawer', {
      method: 'POST',
      body: JSON.stringify(cutoffData),
    });
  },
  getCutoffs: async (params = { limit: 50, page: 1 }) => {
    const query = new URLSearchParams(params).toString();
    return request(`/api/cash-drawer?${query}`);
  },
  getCutoffById: async (id) => {
    return request(`/api/cash-drawer/${id}`);
  },
  deleteCutoff: async (id) => {
    return request(`/api/cash-drawer/${id}`, {
      method: 'DELETE',
    });
  },
};

export const clientService = {
  createClient: async (clientData) => {
    return request('/api/clients', {
      method: 'POST',
      body: JSON.stringify(clientData),
    });
  },
  getAllClients: async (params = { limit: 50, page: 1 }) => {
    const query = new URLSearchParams(params).toString();
    return request(`/api/clients?${query}`);
  },
  getClientById: async (id) => {
    return request(`/api/clients/${id}`);
  },
  getClientByRfc: async (rfc) => {
    return request(`/api/clients/search-rfc?rfc=${encodeURIComponent(rfc)}`);
  },
  updateClient: async (id, clientData) => {
    return request(`/api/clients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(clientData),
    });
  },
  deleteClient: async (id) => {
    return request(`/api/clients/${id}`, {
      method: 'DELETE',
    });
  },
};

export const notasPorCobrarService = {
  list: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/api/notas-por-cobrar${query ? `?${query}` : ''}`);
  },
  getById: async (id) => {
    return request(`/api/notas-por-cobrar/${id}`);
  },
  create: async (data) => {
    return request('/api/notas-por-cobrar', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  update: async (id, data) => {
    return request(`/api/notas-por-cobrar/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  delete: async (id) => {
    return request(`/api/notas-por-cobrar/${id}`, {
      method: 'DELETE',
    });
  },
  cancel: async (id, motivo = '') => {
    return request(`/api/notas-por-cobrar/${id}/cancelar`, {
      method: 'POST',
      body: JSON.stringify({ motivo }),
    });
  },
  addAbono: async (id, data) => {
    return request(`/api/notas-por-cobrar/${id}/abonos`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  removeAbono: async (id, abonoId) => {
    return request(`/api/notas-por-cobrar/${id}/abonos/${abonoId}`, {
      method: 'DELETE',
    });
  },
  summary: async (soloVigentes = true) => {
    return request(`/api/notas-por-cobrar/summary?soloVigentes=${soloVigentes}`);
  },
  vencidas: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/api/notas-por-cobrar/vencidas${query ? `?${query}` : ''}`);
  },
};

export const pagoService = {
  create: async (data) => {
    return request('/api/pagos', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  list: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/api/pagos${query ? `?${query}` : ''}`);
  },
  getById: async (id) => {
    return request(`/api/pagos/${id}`);
  },
};
