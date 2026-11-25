import { api } from '/js/api.js';
import { escapeHtml, rupiah, toast } from '/js/util.js';
import {
  closeModal,
  formatDateTime,
  openModal,
  orderStatusOptions,
  statusPill,
} from '../ui.js';

const TABS = [
  { value: '', label: 'Semua' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Diproses' },
  { value: 'shipped', label: 'Dikirim' },
  { value: 'completed', label: 'Selesai' },
  { value: 'cancelled', label: 'Dibatalkan' },
];

export async function render(root) {
  let filter = '';

  root.innerHTML = `
    <div class="view-head">
      <div>
        <h2>Order management</h2>
        <p>Pesanan dibuat otomatis saat pelanggan checkout via WhatsApp. Perbarui status sesuai alur operasional.</p>
      </div>
    </div>

    <div class="panel">
      <div class="table-tools" id="orderTabs">
        ${TABS.map(
          (tab) =>
            `<button class="abtn abtn--ghost abtn--sm ${
              tab.value === '' ? 'is-active' : ''
            }" type="button" data-status-filter="${tab.value}">${tab.label}</button>`
        ).join('')}
        <span class="table-tools__spacer"></span>
        <span style="font-size:10.5px;color:var(--muted)" id="orderCount"></span>
      </div>

      <div class="table-scroll">
        <table class="table">
          <thead>
            <tr>
              <th>Pesanan</th>
              <th>Item</th>
              <th>Total</th>
              <th>Tanggal</th>
              <th>Status</th>
              <th style="text-align:right">Detail</th>
            </tr>
          </thead>
          <tbody id="orderRows"></tbody>
        </table>
      </div>
    </div>`;

  const tbody = root.querySelector('#orderRows');

  const load = async () => {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-note">Memuat pesanan…</div></td></tr>`;
    const { orders } = await api.admin.orders(filter);
    root.querySelector('#orderCount').textContent = `${orders.length} pesanan`;

    if (!orders.length) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty-note"><i class="fa-solid fa-receipt"></i>Belum ada pesanan pada status ini.</div></td></tr>`;
      return;
    }

    tbody.innerHTML = orders
      .map(
        (order) => `
        <tr data-order="${order.id}">
          <td>
            <strong>${escapeHtml(order.code)}</strong>
            <span style="display:block;font-size:10px;color:var(--muted)">${
              escapeHtml(order.customerName || 'Pelanggan WhatsApp')
            }</span>
          </td>
          <td class="num">${order.itemCount}</td>
          <td class="num">${rupiah(order.total)}</td>
          <td>${formatDateTime(order.createdAt)}</td>
          <td>
            <select class="status-select" data-status-for="${order.id}" aria-label="Status ${escapeHtml(
              order.code
            )}">
              ${orderStatusOptions(order.status)}
            </select>
          </td>
          <td>
            <div class="table-actions">
              <button class="icon-action" type="button" data-view="${order.id}" aria-label="Lihat pesanan ${escapeHtml(
                order.code
              )}"><i class="fa-solid fa-eye"></i></button>
            </div>
          </td>
        </tr>`
      )
      .join('');
  };

  await load();

  root.querySelector('#orderTabs').addEventListener('click', (event) => {
    const button = event.target.closest('[data-status-filter]');
    if (!button) return;
    filter = button.dataset.statusFilter;
    root.querySelectorAll('[data-status-filter]').forEach((node) => {
      node.classList.toggle('is-active', node === button);
    });
    load().catch((error) => toast(error.message, 'error'));
  });

  tbody.addEventListener('change', async (event) => {
    const select = event.target.closest('[data-status-for]');
    if (!select) return;
    select.disabled = true;
    try {
      await api.admin.updateOrderStatus(Number(select.dataset.statusFor), select.value);
      toast('Status pesanan diperbarui.');
      document.dispatchEvent(new CustomEvent('admin:refresh-badge'));
      await load();
    } catch (error) {
      toast(error.message, 'error');
      await load();
    }
  });

  tbody.addEventListener('click', (event) => {
    const button = event.target.closest('[data-view]');
    if (!button) return;
    openOrderDetail(Number(button.dataset.view), load);
  });
}

async function openOrderDetail(orderId, reload) {
  let order;
  try {
    ({ order } = await api.admin.order(orderId));
  } catch (error) {
    toast(error.message, 'error');
    return;
  }

  const card = openModal(`
    <div class="admin-modal__head">
      <div>
        <p class="kicker">Order detail</p>
        <h3>${escapeHtml(order.code)}</h3>
        <p>${formatDateTime(order.createdAt)} · ${statusPill(order.status)}</p>
      </div>
      <button class="modal-close" type="button" data-close-modal aria-label="Tutup">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>

    <div class="order-detail__meta">
      <div><span>Pelanggan</span><strong>${escapeHtml(order.customerName || '—')}</strong></div>
      <div><span>WhatsApp</span><strong>${escapeHtml(order.customerPhone || '—')}</strong></div>
      <div><span>Total</span><strong>${rupiah(order.total)}</strong></div>
    </div>

    <div class="order-items">
      ${order.items
        .map(
          (item) => `
        <div class="order-item">
          <img src="${escapeHtml(item.image || '/assets/placeholder.svg')}" alt="">
          <div>
            <strong>${escapeHtml(item.productName)}</strong>
            <span>${escapeHtml(item.brand)} · EU ${item.size} · ${escapeHtml(item.color || '—')} · ${item.qty} pcs</span>
          </div>
          <strong style="font-size:12px">${rupiah(item.subtotal)}</strong>
        </div>`
        )
        .join('') || '<div class="empty-note">Tidak ada item.</div>'}
    </div>

    ${
      order.note
        ? `<div style="border:1px solid var(--line);padding:10px 12px;margin-bottom:16px;font-size:11.5px;color:var(--muted)">
             <strong style="display:block;font-size:9px;letter-spacing:.18em;text-transform:uppercase;margin-bottom:4px;color:var(--ink)">Catatan</strong>
             ${escapeHtml(order.note)}
           </div>`
        : ''
    }

    <div class="afield">
      <label for="detailStatus">Perbarui status pesanan</label>
      <select class="select" id="detailStatus">${orderStatusOptions(order.status)}</select>
    </div>

    <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:16px">
      <div>
        ${
          order.customerPhone
            ? `<a class="abtn abtn--ghost" target="_blank" rel="noopener" href="https://wa.me/${String(
                order.customerPhone
              ).replace(/\D/g, '').replace(/^0/, '62')}">
                 <i class="fa-brands fa-whatsapp"></i> HUBUNGI PELANGGAN
               </a>`
            : ''
        }
      </div>
      <button class="abtn abtn--primary" type="button" id="saveStatus">SIMPAN STATUS</button>
    </div>`);

  if (!card) return;

  card.querySelector('#saveStatus').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    const nextStatus = card.querySelector('#detailStatus').value;
    button.disabled = true;
    try {
      await api.admin.updateOrderStatus(order.id, nextStatus);
      toast('Status pesanan diperbarui.');
      document.dispatchEvent(new CustomEvent('admin:refresh-badge'));
      closeModal();
      await reload();
    } catch (error) {
      toast(error.message, 'error');
      button.disabled = false;
    }
  });
}
