import { api } from '/js/api.js';
import { escapeHtml, rupiah } from '/js/util.js';
import { formatDate, statusPill } from '../ui.js';

const STATUS_ORDER = ['pending', 'processing', 'shipped', 'completed', 'cancelled'];
const STATUS_LABEL = {
  pending: 'Pending',
  processing: 'Diproses',
  shipped: 'Dikirim',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
};

export async function render(root) {
  const data = await api.admin.dashboard();
  const { stats } = data;
  const maxOrders = Math.max(1, ...data.salesByDay.map((day) => day.orders));
  const totalStatus = Object.values(data.statusBreakdown).reduce((sum, value) => sum + value, 0);

  const bars = data.salesByDay
    .map(
      (day) => `
      <div class="bar-col">
        <span class="bar-value">${day.orders}</span>
        <div class="bar-track"><div class="bar" style="height:${Math.max(
          3,
          (day.orders / maxOrders) * 100
        )}%"></div></div>
        <span class="bar-label">${escapeHtml(day.label)}</span>
      </div>`
    )
    .join('');

  const statusRows = STATUS_ORDER.map((status) => {
    const count = data.statusBreakdown[status] || 0;
    const width = totalStatus ? Math.round((count / totalStatus) * 100) : 0;
    return `
      <div class="status-row">
        <span class="pill pill--${status}">${STATUS_LABEL[status]}</span>
        <div class="status-row__bar"><span style="width:${width}%;background:${
          status === 'cancelled' ? 'var(--red)' : status === 'completed' ? 'var(--green)' : 'var(--mauve)'
        }"></span></div>
        <strong>${count}</strong>
      </div>`;
  }).join('');

  const top = data.topProducts.length
    ? data.topProducts
        .map(
          (product, index) => `
        <div class="rank">
          <span class="rank__num">${String(index + 1).padStart(2, '0')}</span>
          <div>
            <div class="rank__name">${escapeHtml(product.name)}</div>
            <span class="rank__brand">${escapeHtml(product.brand)}</span>
          </div>
          <span class="rank__sold">${product.sold} terjual</span>
        </div>`
        )
        .join('')
    : '<div class="empty-note"><i class="fa-solid fa-chart-simple"></i>Belum ada penjualan. Produk terlaris muncul setelah pesanan pertama.</div>';

  const lowStock = data.lowStock.length
    ? data.lowStock
        .map(
          (product) => `
        <div class="rank">
          <img class="thumb" style="width:38px;height:38px" src="${escapeHtml(product.image)}" alt="">
          <div>
            <div class="rank__name">${escapeHtml(product.name)}</div>
            <span class="rank__brand">${escapeHtml(product.brand)}</span>
          </div>
          <span class="pill pill--low">${product.stock} left</span>
        </div>`
        )
        .join('')
    : '<div class="empty-note"><i class="fa-solid fa-circle-check"></i>Semua produk memiliki stok sehat.</div>';

  const recent = data.recentOrders.length
    ? data.recentOrders
        .map(
          (order) => `
        <tr>
          <td><strong>${escapeHtml(order.code)}</strong></td>
          <td>${escapeHtml(order.customerName || '—')}</td>
          <td class="num">${rupiah(order.total)}</td>
          <td>${statusPill(order.status)}</td>
          <td>${formatDate(order.createdAt)}</td>
        </tr>`
        )
        .join('')
    : `<tr><td colspan="5"><div class="empty-note"><i class="fa-solid fa-receipt"></i>Belum ada pesanan masuk.</div></td></tr>`;

  root.innerHTML = `
    <div class="stat-grid">
      <div class="stat">
        <span class="stat__label"><i class="fa-solid fa-shoe-prints"></i> Total produk</span>
        <div class="stat__value">${stats.totalProducts}</div>
        <div class="stat__meta">${stats.totalDraft} draft · ${stats.outOfStock} habis</div>
      </div>
      <div class="stat">
        <span class="stat__label"><i class="fa-solid fa-layer-group"></i> Total kategori</span>
        <div class="stat__value">${stats.totalCategories}</div>
        <div class="stat__meta">Struktur katalog aktif</div>
      </div>
      <div class="stat">
        <span class="stat__label"><i class="fa-solid fa-boxes-stacked"></i> Total stok</span>
        <div class="stat__value">${stats.totalStock}</div>
        <div class="stat__meta ${stats.outOfStock ? 'is-warn' : ''}"><strong>${
          stats.outOfStock
        }</strong> produk perlu restock</div>
      </div>
      <div class="stat">
        <span class="stat__label"><i class="fa-solid fa-receipt"></i> Total pesanan</span>
        <div class="stat__value">${stats.totalOrders}</div>
        <div class="stat__meta"><strong>${stats.pendingOrders}</strong> menunggu diproses</div>
      </div>
    </div>

    <div class="mini-strip">
      <div class="mini"><span>Pendapatan (non-batal)</span><strong>${rupiah(stats.revenue)}</strong></div>
      <div class="mini"><span>Pesanan pending</span><strong>${stats.pendingOrders}</strong></div>
      <div class="mini"><span>Produk stok rendah</span><strong>${data.lowStock.length}</strong></div>
    </div>

    <div class="admin-grid admin-grid--2">
      <div class="panel">
        <div class="panel__head"><h3>Pesanan 7 hari terakhir</h3><span>${data.salesByDay.reduce(
          (sum, day) => sum + day.orders,
          0
        )} pesanan</span></div>
        <div class="bar-chart">${bars}</div>
        <div style="margin-top:16px"><button class="abtn abtn--ghost abtn--sm" type="button" data-goto="orders">KELOLA PESANAN</button></div>
      </div>
      <div class="panel">
        <div class="panel__head"><h3>Status pesanan</h3><span>${totalStatus} total</span></div>
        <div class="status-list">${statusRows}</div>
      </div>
    </div>

    <div class="admin-grid admin-grid--2">
      <div class="panel">
        <div class="panel__head"><h3>Produk terlaris</h3><span>Berdasarkan qty terjual</span></div>
        <div class="rank-list">${top}</div>
      </div>
      <div class="panel">
        <div class="panel__head"><h3>Stok menipis</h3><span>≤ 5 pasang</span></div>
        <div class="rank-list">${lowStock}</div>
      </div>
    </div>

    <div class="panel">
      <div class="panel__head"><h3>Pesanan terbaru</h3><span>6 terakhir</span></div>
      <div class="table-scroll">
        <table class="table">
          <thead><tr><th>Kode</th><th>Pelanggan</th><th>Total</th><th>Status</th><th>Tanggal</th></tr></thead>
          <tbody>${recent}</tbody>
        </table>
      </div>
    </div>`;

  root.querySelectorAll('[data-goto]').forEach((button) => {
    button.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('admin:navigate', { detail: button.dataset.goto }));
    });
  });
}
