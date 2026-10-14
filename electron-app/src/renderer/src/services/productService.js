const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5002';

async function request(endpoint, options = {}, retries = 3, delay = 1000) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
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

      // Retry on 429 (rate limit) or 503 (service unavailable)
      if ((response.status === 429 || response.status === 503) && attempt < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * (attempt + 1)));
        continue;
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
    } catch (error) {
      if (attempt === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay * (attempt + 1)));
    }
  }
}

export const productService = {
  // List products with pagination, filters, search
  getProducts: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const endpoint = `/api/products${query ? `?${query}` : ''}`;
    return request(endpoint);
  },

  // Get single product by ID
  getProductById: async (id) => {
    return request(`/api/products/${id}`);
  },

  // Get product by SKU
  getProductBySku: async (sku) => {
    return request(`/api/products/sku/${encodeURIComponent(sku)}`);
  },

  // Create new product
  createProduct: async (productData) => {
    return request('/api/products', {
      method: 'POST',
      body: JSON.stringify(productData),
    });
  },

  // Update existing product
  updateProduct: async (id, productData) => {
    return request(`/api/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(productData),
    });
  },

  // Soft delete product
  deleteProduct: async (id) => {
    return request(`/api/products/${id}`, {
      method: 'DELETE',
    });
  },

  // Update product quantity
  updateQuantity: async (id, operacion, cantidad) => {
    return request(`/api/products/${id}/quantity`, {
      method: 'PATCH',
      body: JSON.stringify({ operacion, cantidad }),
    });
  },

  // Get inventory stats
  getInventoryStats: async () => {
    return request('/api/products/stats/inventory');
  },

  // Get low stock products
  getLowStockProducts: async () => {
    return request('/api/products/stock/low');
  },

  // Search products
  searchProducts: async (query) => {
    return request(`/api/products/search?query=${encodeURIComponent(query)}`);
  },

  // Get products by category
  getProductsByCategory: async (categoria) => {
    return request(`/api/products/categoria/${encodeURIComponent(categoria)}`);
  },

  // Bulk update products
  bulkUpdate: async (productIds, updates) => {
    return request('/api/products/bulk/update', {
      method: 'PATCH',
      body: JSON.stringify({ productIds, updates }),
    });
  },

  // Upload products from Excel/CSV (multipart/form-data, field 'file').
  // Uses fetch directly because request() sets Content-Type: application/json
  // which conflicts with FormData's auto-generated multipart boundary.
  // Still reuses the auth pattern (Bearer token) and 401 redirect.
  uploadExcel: async (file, { skipValidation = false } = {}) => {
    const token = localStorage.getItem('token');
    const fd = new FormData();
    fd.append('file', file);
    const qs = skipValidation ? '?skipValidation=true' : '';
    const res = await fetch(`${API_URL}/api/products/upload-excel${qs}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    if (res.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      // Backend returns details: [...] for validation errors, or error: 'NO_FILE' / etc.
      const msg = data.message || data.error || `Error ${res.status}`;
      const details = Array.isArray(data.details) ? data.details : [];
      const err = new Error(msg);
      err.status = res.status;
      err.details = details;
      err.payload = data;
      throw err;
    }
    return data;
  },
};

// Expose internal request helper for sibling services (e.g. images)
productService.request = request;
