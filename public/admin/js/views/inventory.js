import { api } from '/js/api.js';
import { escapeHtml, toast } from '/js/util.js';
import { productPill, setBusy } from '../ui.js';

export async function render(root) {
  const { inventory } = await api.admin.inventory();
  let filter = 'all';

  root.innerHTML = `
    <div class="view-head">
      <div>
        <h2>Inventory</h2>
        <p>Atur stok per ukuran EU. Perubahan langsung memperbarui ketersediaan di katalog pelanggan.</p>
      </div>
      <select class="select" id="inventoryFilter" style="max-width:200px">
        <option value="all">Semua stok</option>
        <option value="low">Stok menipis (≤ 5)</option>
        <option value="out">Produk habis</option>
      </select>
    </div>

    <div class="panel">
      <div class="table-tools">
        <span style="font-family:var(--label);font-size:8.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--muted)">Ketersediaan per ukuran &amp; warna</span>
        <span class="table-tools__spacer"></span>
        <span style="font-size:10.5px;color:var(--muted)" id="inventoryCount"></span>
      </div>
      <div class="table-scroll">
        <table class="table">
          <thead>
            <tr>
              <th>Produk</th>
              <th>Warna</th>
              <th>Stok per ukuran</th>
              <th>Total</th>
              <th>Status</th>
              <th style="text-align:right">Aksi</th>
            </tr>
          </thead>
          <tbody id="inventoryRows"></tbody>
        </table>
      </div>
    </div>`;

  const tbody = root.querySelector('#inventoryRows');

  const visibleRows = () =>
    inventory.filter((product) => {
      if (filter === 'out') return product.stock === 0;
      if (filter === 'low') return product.stock > 0 && product.stock <= 5;
      return true;
    });

  const paint = () => {
    const rows = visibleRows();
    root.querySelector('#inventoryCount').textContent = `${rows.length} produk`;
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty-note"><i class="fa-solid fa-boxes-stacked"></i>Tidak ada produk pada filter ini.</div></td></tr>`;
      return;
    }

    tbody.innerHTML = rows
      .map(
        (product) => `
        <tr data-product="${product.id}" data-name="${escapeHtml(product.name)}">
          <td>
            <div class="cell-product">
              <img class="thumb" src="${escapeHtml(product.image || '/assets/placeholder.svg')}" alt="">
              <div>
                <strong>${escapeHtml(product.name)}</strong>
                <span>${escapeHtml(product.brand)} · ${escapeHtml(product.category || '—')}</span>
              </div>
            </div>
          </td>
          <td>
            <div style="display:flex;gap:5px;flex-wrap:wrap">
              ${product.colors
                .map(
                  (color) =>
                    `<span title="${escapeHtml(color.name)}" style="width:14px;height:14px;border-radius:50%;border:1px solid rgba(24,21,20,.25);background:${escapeHtml(
                      color.hex
                    )}"></span>`
                )
                .join('')}
            </div>
            <span style="font-size:9.5px;color:var(--muted);display:block;margin-top:4px">${product.colors.length} warna</span>
          </td>
          <td>
            <div class="inv-sizes">
              ${product.sizes
                .map(
                  (size) => `
                <label class="inv-size ${size.stock === 0 ? 'is-out' : size.stock <= 3 ? 'is-low' : ''}">
                  <span>EU ${size.size}</span>
                  <input type="number" min="0" max="10000" value="${size.stock}" data-size="${size.size}" aria-label="Stok EU ${size.size}">
                </label>`
                )
                .join('')}
            </div>
          </td>
          <td class="num" data-total>${product.stock}</td>
          <td data-status>${productPill({ status: 'active', stock: product.stock })}</td>
          <td>
            <div class="table-actions">
              <button class="abtn abtn--ghost abtn--sm" type="button" data-save="${product.id}">SIMPAN</button>
            </div>
          </td>
        </tr>`
      )
      .join('');
  };

  paint();

  root.querySelector('#inventoryFilter').addEventListener('change', (event) => {
    filter = event.target.value;
    paint();
  });

  tbody.addEventListener('input', (event) => {
    const input = event.target.closest('input[data-size]');
    if (!input) return;
    const row = input.closest('tr');
    const total = [...row.querySelectorAll('input[data-size]')].reduce(
      (sum, node) => sum + (Number(node.value) || 0),
      0
    );
    row.querySelector('[data-total]').textContent = total;
    row.querySelector('[data-status]').innerHTML = productPill({ status: 'active', stock: total });
    input.closest('.inv-size')?.classList.toggle('is-out', Number(input.value) === 0);
    input.closest('.inv-size')?.classList.toggle('is-low', Number(input.value) > 0 && Number(input.value) <= 3);
  });

  tbody.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-save]');
    if (!button) return;
    const row = button.closest('tr');
    const productId = Number(row.dataset.product);
    const product = inventory.find((item) => item.id === productId);
    if (!product) return;

    const sizes = [...row.querySelectorAll('input[data-size]')].map((input) => ({
      size: Number(input.dataset.size),
      stock: Number(input.value),
    }));

    if (sizes.some((entry) => !Number.isFinite(entry.stock) || entry.stock < 0)) {
      toast('Stok harus berupa angka 0 atau lebih.', 'error');
      return;
    }

    setBusy(button, true, 'MENYIMPAN…');
    try {
      const result = await api.admin.updateStock(productId, sizes);
      product.stock = result.stock;
      product.sizes = sizes;
      row.querySelector('[data-total]').textContent = result.stock;
      row.querySelector('[data-status]').innerHTML = productPill({ status: 'active', stock: result.stock });
      toast(`Stok ${product.name} diperbarui menjadi ${result.stock} pasang.`);
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setBusy(button, false);
    }
  });
}
