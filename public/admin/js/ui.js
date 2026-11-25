import { escapeHtml } from '/js/util.js';

export const ORDER_STATUS = {
  pending: { label: 'Pending', cls: 'pending' },
  processing: { label: 'Diproses', cls: 'processing' },
  shipped: { label: 'Dikirim', cls: 'shipped' },
  completed: { label: 'Selesai', cls: 'completed' },
  cancelled: { label: 'Dibatalkan', cls: 'cancelled' },
};

export function orderStatusOptions(selected = 'pending') {
  return Object.entries(ORDER_STATUS)
    .map(
      ([value, meta]) =>
        `<option value="${value}" ${value === selected ? 'selected' : ''}>${meta.label}</option>`
    )
    .join('');
}

export function statusPill(status) {
  const meta = ORDER_STATUS[status];
  if (!meta) return `<span class="pill pill--draft">${escapeHtml(status)}</span>`;
  return `<span class="pill pill--${meta.cls}">${meta.label}</span>`;
}

export function productPill(product) {
  if (product.status === 'draft') return '<span class="pill pill--draft">Draft</span>';
  if (product.stock <= 0) return '<span class="pill pill--out">Habis</span>';
  if (product.stock <= 5) return '<span class="pill pill--low">Stok rendah</span>';
  return '<span class="pill pill--active">Aktif</span>';
}

export function formatDate(value) {
  if (!value) return '—';
  const iso = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(value) {
  if (!value) return '—';
  const iso = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const modalRoot = () => document.getElementById('adminModal');

export function openModal(html, { small = false } = {}) {
  const root = modalRoot();
  if (!root) return null;
  root.innerHTML = `<div class="admin-modal__card${small ? ' admin-modal__card--sm' : ''}">${html}</div>`;
  root.classList.add('is-open');
  root.onclick = (event) => {
    if (event.target === root) closeModal();
  };
  root.querySelectorAll('[data-close-modal]').forEach((button) => {
    button.addEventListener('click', closeModal);
  });
  document.body.style.overflow = 'hidden';
  return root.querySelector('.admin-modal__card');
}

export function closeModal() {
  const root = modalRoot();
  if (!root) return;
  root.classList.remove('is-open');
  root.innerHTML = '';
  root.onclick = null;
  document.body.style.overflow = '';
}

export function confirmDialog({
  title,
  message,
  confirmLabel = 'Hapus',
  cancelLabel = 'Batal',
  danger = true,
}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'admin-modal is-open';
    overlay.style.zIndex = '320';
    overlay.innerHTML = `
      <div class="admin-modal__card admin-modal__card--sm">
        <div class="admin-modal__head">
          <div>
            <p class="kicker">Konfirmasi</p>
            <h3>${escapeHtml(title)}</h3>
          </div>
        </div>
        <p style="font-size:12.5px;color:var(--muted);line-height:1.8;margin-bottom:20px">${escapeHtml(message)}</p>
        <div style="display:flex;justify-content:flex-end;gap:10px">
          <button class="abtn abtn--ghost" type="button" data-cancel>${escapeHtml(cancelLabel)}</button>
          <button class="abtn ${danger ? 'abtn--danger' : 'abtn--primary'}" type="button" data-confirm>${escapeHtml(confirmLabel)}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const finish = (value) => {
      overlay.remove();
      resolve(value);
    };
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) finish(false);
    });
    overlay.querySelector('[data-cancel]').addEventListener('click', () => finish(false));
    overlay.querySelector('[data-confirm]').addEventListener('click', () => finish(true));
  });
}

export function setBusy(button, busy, label = 'MENYIMPAN…') {
  if (!button) return;
  if (busy) {
    button.dataset.original = button.innerHTML;
    button.disabled = true;
    button.innerHTML = label;
  } else {
    button.disabled = false;
    if (button.dataset.original) button.innerHTML = button.dataset.original;
  }
}

export function imageUrl(url) {
  return url || '/assets/placeholder.svg';
}

export function handleAuthError(error) {
  if (error?.status === 401) {
    window.location.href = '/admin/login';
    return true;
  }
  return false;
}
