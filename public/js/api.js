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

function uploadFiles(files, { productId = 'draft', onProgress } = {}) {
  const list = [...(files || [])];
  if (!list.length) return Promise.resolve([]);

  const form = new FormData();
  for (const file of list) form.append('files', file);
  form.append('productId', String(productId || 'draft'));

  // XMLHttpRequest dipakai agar progres unggahan bisa ditampilkan.
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');
    xhr.withCredentials = true;

    xhr.upload.addEventListener('progress', (event) => {
      if (!event.lengthComputable) return;
      onProgress?.(event.loaded / event.total);
    });

    xhr.addEventListener('load', () => {
      let data = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        data = null;
      }
      if (xhr.status >= 200 && xhr.status < 300 && Array.isArray(data?.urls)) {
        onProgress?.(1);
        resolve(data.urls);
        return;
      }
      const error = new Error(data?.error || 'Gagal mengunggah gambar.');
      error.status = xhr.status;
      reject(error);
    });

    xhr.addEventListener('error', () => reject(new Error('Koneksi upload terputus. Coba lagi.')));
    xhr.addEventListener('abort', () => reject(new Error('Upload dibatalkan.')));
    xhr.send(form);
  });
}

export const api = {
  store: () => request('/api/store'),
  health: () => request('/api/health'),
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
    saveFrames: (id, frames) =>
      request(`/api/admin/products/${id}/frames`, { method: 'PUT', body: { frames } }),

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
