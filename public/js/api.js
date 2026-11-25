async function request(url, { method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const error = new Error(data?.error || 'Terjadi kesalahan. Silakan coba lagi.');
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

async function uploadFiles(files) {
  const form = new FormData();
  for (const file of files) form.append('files', file);
  const response = await fetch('/api/upload', {
    method: 'POST',
    credentials: 'same-origin',
    body: form,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.error || 'Gagal mengunggah gambar.');
    error.status = response.status;
    throw error;
  }
  return data.urls;
}

export const api = {
  store: () => request('/api/store'),
  products: (query = '') => request(`/api/store/products${query ? `?${query}` : ''}`),
  product: (id) => request(`/api/store/products/${id}`),
  createOrder: (payload) => request('/api/store/orders', { method: 'POST', body: payload }),

  login: (username, password) =>
    request('/api/auth/login', { method: 'POST', body: { username, password } }),
  logout: () => request('/api/auth/logout', { method: 'POST', body: {} }),
  me: () => request('/api/auth/me'),

  admin: {
    dashboard: () => request('/api/admin/dashboard'),
    products: () => request('/api/admin/products'),
    product: (id) => request(`/api/admin/products/${id}`),
    createProduct: (payload) => request('/api/admin/products', { method: 'POST', body: payload }),
    updateProduct: (id, payload) =>
      request(`/api/admin/products/${id}`, { method: 'PUT', body: payload }),
    deleteProduct: (id) => request(`/api/admin/products/${id}`, { method: 'DELETE' }),

    categories: () => request('/api/admin/categories'),
    createCategory: (payload) => request('/api/admin/categories', { method: 'POST', body: payload }),
    updateCategory: (id, payload) =>
      request(`/api/admin/categories/${id}`, { method: 'PUT', body: payload }),
    deleteCategory: (id) => request(`/api/admin/categories/${id}`, { method: 'DELETE' }),

    inventory: () => request('/api/admin/inventory'),
    updateStock: (productId, sizes) =>
      request(`/api/admin/inventory/${productId}`, { method: 'PUT', body: { sizes } }),

    orders: (status = '') =>
      request(`/api/admin/orders${status ? `?status=${encodeURIComponent(status)}` : ''}`),
    order: (id) => request(`/api/admin/orders/${id}`),
    updateOrderStatus: (id, status) =>
      request(`/api/admin/orders/${id}/status`, { method: 'PATCH', body: { status } }),

    settings: () => request('/api/admin/settings'),
    saveSettings: (payload) => request('/api/admin/settings', { method: 'PUT', body: payload }),
  },

  upload: uploadFiles,
};
