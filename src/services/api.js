
const API_URL = process.env.VITE_API_URL;


async function request(endpoint, options = {}) {
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

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Request failed');
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
    return request(`/api/invoices${query ? `?${query}` : ''}`);
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
};

export const productService = {
  getProducts: async () => {
    return request('/api/productos');
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
    return request(`/api/sales?${query}`).then(response => response.data);
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
