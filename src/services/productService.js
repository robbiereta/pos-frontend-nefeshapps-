const API_URL = import.meta.env.VITE_API_URL;

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

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Request failed');
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
    console.log('🟢 productService.getProducts called');
    console.log('🟢 API_URL:', API_URL);
    console.log('🟢 Endpoint:', endpoint);
    console.log('🟢 Full URL:', `${API_URL}${endpoint}`);
    console.log('🟢 Token exists:', !!localStorage.getItem('token'));
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
};
