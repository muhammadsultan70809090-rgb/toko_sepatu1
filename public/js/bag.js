import { api } from './api.js';
import { escapeHtml, rupiah, toast } from './util.js';

const STORAGE_KEY = 'ss_bag_v1';

let items = [];
let panel = null;
let scrim = null;
let modal = null;
let settings = { whatsapp: '6282122190680', storeName: 'SneakerSpace' };

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((item) => item && item.productId) : [];
  } catch {
    return [];
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* storage penuh atau diblokir — keranjang tetap berjalan di sesi ini */
  }
}

const count = () => items.reduce((sum, item) => sum + item.qty, 0);
const subtotal = () => items.reduce((sum, item) => sum + item.price * item.qty, 0);

function syncCounters() {
  document.querySelectorAll('[data-bag-count]').forEach((node) => {
    node.textContent = String(count());
    node.classList.remove('is-bump');
    void node.offsetWidth;
    node.classList.add('is-bump');
  });
  const headingCount = panel?.querySelector('[data-count]');
  if (headingCount) headingCount.textContent = `(${count()})`;
}

function itemTemplate(item) {
  return `
    <article class="bag-item">
      <div class="bag-item__img">
        <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" loading="lazy">
      </div>
      <div>
        <h3 class="bag-item__name">${escapeHtml(item.name)}</h3>
        <p class="bag-item__meta">${escapeHtml(item.brand)} · EU ${item.size} · ${escapeHtml(item.color)}</p>
        <p class="bag-item__price">${rupiah(item.price)}</p>
        <div class="qty" style="margin-top:8px;width:max-content">
          <button type="button" data-bag-action="dec" data-key="${escapeHtml(item.key)}" aria-label="Kurangi jumlah">−</button>
          <span>${item.qty}</span>
          <button type="button" data-bag-action="inc" data-key="${escapeHtml(item.key)}" aria-label="Tambah jumlah">+</button>
        </div>
      </div>
      <div class="bag-item__actions">
        <button type="button" class="bag-item__remove" data-bag-action="remove" data-key="${escapeHtml(item.key)}">Hapus</button>
        <strong style="font-size:12.5px">${rupiah(item.price * item.qty)}</strong>
      </div>
    </article>`;
}

function render() {
  if (!panel) return;
  const body = panel.querySelector('[data-bag-body]');
  const foot = panel.querySelector('[data-bag-foot]');

  body.innerHTML = items.length
    ? items.map(itemTemplate).join('')
    : `<div class="bag__empty">
         <i class="fa-solid fa-bag-shopping" aria-hidden="true"></i>
         <h3>Your bag is empty</h3>
         <p>Rak showroom kami menunggu. Temukan pasangan yang tepat untuk langkah Anda.</p>
         <button class="btn btn--ink" type="button" data-bag-action="close">EXPLORE COLLECTION</button>
       </div>`;

  const total = subtotal();
  foot.innerHTML = `
    <div class="bag__row"><span>Subtotal</span><span>${rupiah(total)}</span></div>
    <div class="bag__row"><span>Pengiriman</span><span>Dihitung via WhatsApp</span></div>
    <div class="bag__row bag__row--total"><span>Total</span><strong>${rupiah(total)}</strong></div>
    <button class="btn btn--ink btn--block" type="button" data-bag-action="checkout" ${
      items.length ? '' : 'disabled style="opacity:.45;pointer-events:none"'
    }>
      ORDER VIA WHATSAPP <i class="fa-brands fa-whatsapp"></i>
    </button>
    <p class="bag__note">Checkout akan membuat pesanan di toko dan membuka WhatsApp untuk konfirmasi.</p>`;

  syncCounters();
}

function open() {
  if (!panel) return;
  panel.classList.add('is-open');
  panel.setAttribute('aria-hidden', 'false');
  scrim?.classList.add('is-open');
  document.body.style.overflow = 'hidden';
}

function close() {
  panel?.classList.remove('is-open');
  panel?.setAttribute('aria-hidden', 'true');
  scrim?.classList.remove('is-open');
  if (!modal?.classList.contains('is-open')) document.body.style.overflow = '';
}

export function addToBag(product, size, color, qty = 1) {
  const sizeRow = (product.sizes || []).find((row) => Number(row.size) === Number(size));
  if (!sizeRow) {
    toast('Pilih ukuran terlebih dahulu.', 'error');
    return false;
  }
  if (sizeRow.stock <= 0) {
    toast(`Ukuran EU ${size} sedang habis.`, 'error');
    return false;
  }
  if (!color) {
    toast('Pilih warna terlebih dahulu.', 'error');
    return false;
  }

  const key = `${product.id}-${size}-${color}`;
  const existing = items.find((item) => item.key === key);
  const nextQty = (existing?.qty || 0) + qty;
  if (nextQty > sizeRow.stock) {
    toast(`Stok ukuran EU ${size} tersisa ${sizeRow.stock} pasang.`, 'error');
    return false;
  }

  if (existing) {
    existing.qty = nextQty;
    existing.maxStock = sizeRow.stock;
  } else {
    items.push({
      key,
      productId: product.id,
      name: product.name,
      brand: product.brand,
      price: product.price,
      image: product.image,
      size: Number(size),
      color,
      qty,
      maxStock: sizeRow.stock,
    });
  }

  persist();
  render();
  toast(`${product.name} · EU ${size} ditambahkan ke tas.`);
  open();
  return true;
}

function changeQty(key, delta) {
  const item = items.find((entry) => entry.key === key);
  if (!item) return;
  const next = item.qty + delta;
  if (next < 1) {
    removeItem(key);
    return;
  }
  if (next > item.maxStock) {
    toast(`Stok tersisa ${item.maxStock} pasang untuk ukuran ini.`, 'error');
    return;
  }
  item.qty = next;
  persist();
  render();
}

function removeItem(key) {
  items = items.filter((entry) => entry.key !== key);
  persist();
  render();
  toast('Produk dihapus dari tas.');
}

/* ------------------------------- checkout -------------------------------- */

function buildModal() {
  modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = 'checkoutModal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Checkout pesanan');
  modal.innerHTML = `
    <div class="modal__card">
      <div class="modal__head">
        <div>
          <p class="kicker">Checkout</p>
          <h2>COMPLETE YOUR ORDER</h2>
        </div>
        <button class="modal__close" type="button" data-checkout-close aria-label="Tutup">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <p class="modal__intro">Isi data singkat berikut. Pesanan tercatat di toko, lalu Anda diarahkan ke WhatsApp untuk konfirmasi pembayaran dan pengiriman.</p>
      <div class="checkout__summary" data-checkout-summary></div>
      <form data-checkout-form novalidate>
        <div class="field">
          <label for="coName">Nama lengkap</label>
          <input id="coName" name="name" type="text" placeholder="Nama penerima" maxlength="120" autocomplete="name">
        </div>
        <div class="field">
          <label for="coPhone">Nomor WhatsApp</label>
          <input id="coPhone" name="phone" type="tel" placeholder="08xx xxxx xxxx" maxlength="40" autocomplete="tel">
        </div>
        <div class="field">
          <label for="coNote">Catatan (opsional)</label>
          <textarea id="coNote" name="note" maxlength="500" placeholder="Alamat pengiriman atau permintaan khusus"></textarea>
        </div>
        <p class="field__error" data-checkout-error></p>
        <button class="btn btn--ink btn--block" type="submit" data-checkout-submit>
          ORDER VIA WHATSAPP <i class="fa-brands fa-whatsapp"></i>
        </button>
      </form>
    </div>`;
  document.body.appendChild(modal);

  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeCheckout();
  });
  modal.querySelector('[data-checkout-close]').addEventListener('click', closeCheckout);
  modal.querySelector('[data-checkout-form]').addEventListener('submit', submitOrder);
}

function openCheckout() {
  if (!items.length) {
    toast('Tas masih kosong.', 'error');
    return;
  }
  modal.querySelector('[data-checkout-summary]').innerHTML = `
    ${items
      .map(
        (item) =>
          `<div><span>${escapeHtml(item.name)} · EU ${item.size} × ${item.qty}</span><span>${rupiah(
            item.price * item.qty
          )}</span></div>`
      )
      .join('')}
    <div><span>Total</span><span>${rupiah(subtotal())}</span></div>`;
  modal.querySelector('[data-checkout-error]').textContent = '';
  modal.classList.add('is-open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => modal.querySelector('#coName')?.focus(), 260);
}

function closeCheckout() {
  modal?.classList.remove('is-open');
  if (!panel?.classList.contains('is-open')) document.body.style.overflow = '';
}

function whatsappMessage(order) {
  const lines = [
    `Halo ${settings.storeName || 'SneakerSpace'}! Saya ingin memesan:`,
    '',
    `Kode Pesanan: ${order.code}`,
    '',
  ];
  order.items.forEach((item, index) => {
    lines.push(`${index + 1}. ${item.productName}`);
    lines.push(`Brand: ${item.brand}`);
    lines.push(`Ukuran: EU ${item.size}`);
    lines.push(`Warna: ${item.color || '-'}`);
    lines.push(`Jumlah: ${item.qty}`);
    lines.push(`Harga: ${rupiah(item.price)}`);
    lines.push(`Subtotal: ${rupiah(item.subtotal)}`);
    lines.push('');
  });
  lines.push(`TOTAL: ${rupiah(order.total)}`);
  if (order.customerName) lines.push(`Nama: ${order.customerName}`);
  if (order.customerPhone) lines.push(`WhatsApp: ${order.customerPhone}`);
  if (order.note) lines.push(`Catatan: ${order.note}`);
  lines.push('');
  lines.push('Mohon konfirmasi ketersediaan produk dan metode pembayaran. Terima kasih!');
  return lines.join('\n');
}

async function submitOrder(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const name = form.querySelector('#coName').value.trim();
  const phone = form.querySelector('#coPhone').value.trim();
  const note = form.querySelector('#coNote').value.trim();
  const errorNode = modal.querySelector('[data-checkout-error]');

  if (phone && !/^[0-9+\-\s()]{8,}$/.test(phone)) {
    errorNode.textContent = 'Nomor WhatsApp tidak valid.';
    return;
  }

  const button = form.querySelector('[data-checkout-submit]');
  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = 'MEMPROSES PESANAN…';
  errorNode.textContent = '';

  try {
    const { order } = await api.createOrder({
      customerName: name,
      customerPhone: phone,
      note,
      items: items.map((item) => ({
        productId: item.productId,
        size: item.size,
        color: item.color,
        qty: item.qty,
      })),
    });

    const number = String(settings.whatsapp || '6282122190680').replace(/\D/g, '');
    const url = `https://wa.me/${number}?text=${encodeURIComponent(whatsappMessage(order))}`;
    const popup = window.open(url, '_blank', 'noopener');
    if (!popup) window.location.href = url;

    items = [];
    persist();
    render();
    closeCheckout();
    close();
    toast(`Pesanan ${order.code} dibuat. Lanjutkan konfirmasi di WhatsApp.`);
  } catch (error) {
    errorNode.textContent = error.message;
    toast(error.message, 'error');
  } finally {
    button.disabled = false;
    button.innerHTML = original;
  }
}

/* --------------------------------- init ---------------------------------- */

export function initBag(bagSettings = {}) {
  settings = { ...settings, ...bagSettings };
  panel = document.getElementById('bag');
  if (!panel) return;

  panel.innerHTML = `
    <div class="bag__head">
      <div>
        <p class="kicker">Shopping bag</p>
        <h2>YOUR BAG <span data-count>(0)</span></h2>
      </div>
      <button class="bag__close" type="button" data-bag-action="close" aria-label="Tutup tas">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
    <div class="bag__body" data-bag-body></div>
    <div class="bag__foot" data-bag-foot></div>`;

  scrim = document.createElement('div');
  scrim.className = 'scrim';
  scrim.addEventListener('click', close);
  document.body.appendChild(scrim);

  buildModal();

  document.querySelectorAll('#openBag, [data-open-bag]').forEach((button) => {
    button.addEventListener('click', open);
  });

  panel.addEventListener('click', (event) => {
    const target = event.target.closest('[data-bag-action]');
    if (!target) return;
    const action = target.dataset.bagAction;
    const key = target.dataset.key;

    if (action === 'close') {
      close();
      if (items.length === 0) {
        document.getElementById('collection')?.scrollIntoView({ behavior: 'smooth' });
      }
    }
    if (action === 'inc') changeQty(key, 1);
    if (action === 'dec') changeQty(key, -1);
    if (action === 'remove') removeItem(key);
    if (action === 'checkout') openCheckout();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (modal?.classList.contains('is-open')) closeCheckout();
    else if (panel.classList.contains('is-open')) close();
  });

  items = load();
  render();
}

export const bagState = {
  get items() {
    return [...items];
  },
  open,
  close,
};
