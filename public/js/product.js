import { api } from './api.js';
import { addToBag } from './bag.js';
import { productCard } from './card.js';
import { initShell } from './site.js';
import { escapeHtml, rupiah, stockMeta, toast } from './util.js';
import { SneakerViewer } from './viewer.js';

const $ = (selector, context = document) => context.querySelector(selector);

const productId = Number(window.location.pathname.split('/').filter(Boolean).pop());

function notFound(message) {
  const root = $('#pdRoot');
  if (!root) return;
  root.innerHTML = `
    <div class="empty" style="margin-top:40px">
      <h3>${escapeHtml(message)}</h3>
      <p>Produk mungkin sudah dihapus atau tidak lagi dijual.</p>
      <a class="btn btn--ink" href="/#collection">BACK TO COLLECTION</a>
    </div>`;
}

function render(product, related) {
  document.title = `${product.name} — SneakerSpace`;
  const root = $('#pdRoot');
  const stock = stockMeta(product.stock);
  const availableSizes = product.sizes.filter((row) => row.stock > 0);
  const defaultSize = availableSizes[0]?.size ?? product.sizes[0]?.size ?? null;
  const defaultColor = product.colors[0]?.name || '';

  root.innerHTML = `
    <nav class="pd__crumb" aria-label="Breadcrumb">
      <a href="/">Home</a>
      <i class="fa-solid fa-chevron-right"></i>
      <a href="/#collection">Collection</a>
      <i class="fa-solid fa-chevron-right"></i>
      <span>${escapeHtml(product.name)}</span>
    </nav>

    <div class="pd__grid">
      <div class="pd__media">
        <div class="pd__plate">
          <span class="pd__index">${String(product.id).padStart(2, '0')}</span>
          ${product.badge ? `<span class="pd__badge">${escapeHtml(product.badge)}</span>` : ''}
          <img id="pdImage" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)} oleh ${escapeHtml(product.brand)}">
        </div>
        <div class="pd__caption">
          <span>${escapeHtml(product.brand)} — ${escapeHtml(product.category || 'Sneaker')}</span>
          <span>SNEAKERSPACE / CAMPAIGN AW26</span>
        </div>
      </div>

      <div class="pd__info">
        <p class="pd__brand">${escapeHtml(product.brand)} · ${escapeHtml(product.category || '')}</p>
        <h1 class="pd__title">${escapeHtml(product.name)}</h1>
        <div class="pd__price-row">
          <span class="pd__price">${rupiah(product.price)}</span>
          <span class="pd__tax">Termasuk pajak</span>
          <span class="pd__status ${stock.cls}" id="pdStatus">${stock.label}</span>
        </div>

        <p class="pd__desc">${escapeHtml(product.description)}</p>

        <dl class="pd__spec">
          <div><dt>Material</dt><dd>${escapeHtml(product.material || '—')}</dd></div>
          <div><dt>Category</dt><dd>${escapeHtml(product.category || '—')}</dd></div>
          <div><dt>Colours</dt><dd>${product.colors.length} pilihan</dd></div>
          <div><dt>SKU</dt><dd>SS-${String(product.id).padStart(4, '0')}</dd></div>
        </dl>

        <div class="option-label">Select size (EU) <span id="sizeStockLabel"></span></div>
        <div class="sizes" id="sizeList" role="group" aria-label="Pilihan ukuran EU">
          ${product.sizes
            .map(
              (row) => `
            <button class="size${row.size === defaultSize ? ' is-selected' : ''}" type="button"
              data-size="${row.size}" ${row.stock <= 0 ? 'disabled' : ''}
              aria-pressed="${row.size === defaultSize}">
              ${row.size}<small>${row.stock > 0 ? `${row.stock} left` : 'sold out'}</small>
            </button>`
            )
            .join('')}
        </div>

        <div class="option-label">Select colour <span id="colorLabel">${escapeHtml(defaultColor)}</span></div>
        <div class="colors" id="colorList" role="group" aria-label="Pilihan warna">
          ${product.colors
            .map(
              (color, index) => `
            <button class="color${index === 0 ? ' is-selected' : ''}" type="button"
              data-color="${escapeHtml(color.name)}" style="background:${escapeHtml(color.hex)}"
              title="${escapeHtml(color.name)}" aria-label="${escapeHtml(color.name)}"
              aria-pressed="${index === 0}"></button>`
            )
            .join('')}
          <span class="color__name">${escapeHtml(defaultColor)}</span>
        </div>

        <div class="pd__actions">
          <button class="btn btn--ink" type="button" id="addToBagBtn" ${
            product.stock <= 0 ? 'disabled style="opacity:.45;pointer-events:none"' : ''
          }>
            ${product.stock <= 0 ? 'SOLD OUT' : 'ADD TO BAG'} <i class="fa-solid fa-bag-shopping"></i>
          </button>
          <button class="btn btn--ghost" type="button" id="detailBtn" aria-expanded="false" aria-controls="pdDetail">
            DETAIL <i class="fa-solid fa-plus" id="detailIcon"></i>
          </button>
        </div>
        <p class="pd__hint">Stok ditampilkan secara real-time dari dashboard toko. 360° view tersedia di dalam DETAIL.</p>

        <section class="pd__detail" id="pdDetail" aria-label="Detail produk dan tampilan 360 derajat">
          <div class="pd__detail-head">
            <h3>Product detail &amp; 360° view</h3>
            <span>Drag / geser untuk memutar</span>
          </div>
          <div class="viewer">
            <div class="viewer__stage" id="viewerStage">
              <span class="viewer__badge" id="viewerBadge">360° PRODUCT VIEW</span>
              <img id="viewerImage" src="${escapeHtml(product.image)}" alt="Tampilan 360 derajat ${escapeHtml(
                product.name
              )}" draggable="false">
              <span class="viewer__angle" id="viewerAngle">0°</span>
            </div>
            <div class="viewer__controls">
              <button class="viewer__btn" type="button" data-viewer-step="-1" aria-label="Putar ke kiri">
                <i class="fa-solid fa-rotate-left"></i>
              </button>
              <input class="viewer__range" id="viewerRange" type="range" min="0" max="359" step="1" value="0"
                aria-label="Putaran 360 derajat">
              <button class="viewer__btn" type="button" data-viewer-step="1" aria-label="Putar ke kanan">
                <i class="fa-solid fa-rotate-right"></i>
              </button>
            </div>
            <p class="viewer__hint" id="viewerHint"></p>
          </div>
          <dl class="pd__spec" style="margin-top:18px;border-bottom:0">
            <div><dt>Material</dt><dd>${escapeHtml(product.material || '—')}</dd></div>
            <div><dt>Total stok</dt><dd>${product.stock} pasang</dd></div>
            <div><dt>Ukuran tersedia</dt><dd>${availableSizes.map((row) => row.size).join(', ') || '—'}</dd></div>
            <div><dt>Warna</dt><dd>${product.colors.map((color) => escapeHtml(color.name)).join(', ')}</dd></div>
          </dl>
          <p class="pd__desc" style="font-size:12.5px">${escapeHtml(product.description)}</p>
        </section>
      </div>
    </div>

    <section class="pd__related">
      <div class="section__head">
        <div>
          <p class="kicker">Companion pieces</p>
          <h2 class="section__title">PAIR IT <em>WITH</em></h2>
        </div>
        <p class="section__desc">Silhouette lain dari kategori yang sama, dikurasi untuk melengkapi gaya Anda.</p>
      </div>
      <div class="products">${related.map((item) => productCard(item, { reveal: false })).join('')}</div>
    </section>`;

  let selectedSize = defaultSize;
  let selectedColor = defaultColor;

  const sizeStockLabel = $('#sizeStockLabel');
  const updateSizeLabel = () => {
    const row = product.sizes.find((entry) => entry.size === selectedSize);
    if (sizeStockLabel) {
      sizeStockLabel.textContent = row ? `${row.stock} pasang tersedia` : 'Pilih ukuran';
    }
  };
  updateSizeLabel();

  $('#sizeList').addEventListener('click', (event) => {
    const button = event.target.closest('.size');
    if (!button || button.disabled) return;
    selectedSize = Number(button.dataset.size);
    document.querySelectorAll('#sizeList .size').forEach((node) => {
      const isSelected = node === button;
      node.classList.toggle('is-selected', isSelected);
      node.setAttribute('aria-pressed', String(isSelected));
    });
    updateSizeLabel();
  });

  $('#colorList').addEventListener('click', (event) => {
    const button = event.target.closest('.color');
    if (!button) return;
    selectedColor = button.dataset.color;
    document.querySelectorAll('#colorList .color').forEach((node) => {
      const isSelected = node === button;
      node.classList.toggle('is-selected', isSelected);
      node.setAttribute('aria-pressed', String(isSelected));
    });
    const label = $('#colorLabel');
    if (label) label.textContent = selectedColor;
    const name = document.querySelector('.color__name');
    if (name) name.textContent = selectedColor;
  });

  $('#addToBagBtn')?.addEventListener('click', () => {
    if (!selectedSize) {
      toast('Pilih ukuran terlebih dahulu.', 'error');
      return;
    }
    addToBag(product, selectedSize, selectedColor, 1);
  });

  const viewer = new SneakerViewer({
    stage: $('#viewerStage'),
    image: $('#viewerImage'),
    slider: $('#viewerRange'),
    angleLabel: $('#viewerAngle'),
    hint: $('#viewerHint'),
    badge: $('#viewerBadge'),
  });
  viewer.setProduct(product);

  const detail = $('#pdDetail');
  const detailButton = $('#detailBtn');
  detailButton?.addEventListener('click', () => {
    const isOpen = detail.classList.toggle('is-open');
    detailButton.setAttribute('aria-expanded', String(isOpen));
    const icon = $('#detailIcon');
    if (icon) icon.className = `fa-solid ${isOpen ? 'fa-minus' : 'fa-plus'}`;
    if (isOpen) {
      setTimeout(() => detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 120);
    }
  });
}

async function boot() {
  try {
    if (!Number.isFinite(productId) || productId <= 0) {
      notFound('Produk tidak ditemukan.');
      return;
    }
    const { product, related, settings } = await api.product(productId);
    initShell(settings);
    render(product, related);
  } catch (error) {
    console.error(error);
    const { settings } = { settings: {} };
    initShell(settings);
    notFound(error.status === 404 ? 'Produk tidak ditemukan.' : 'Produk gagal dimuat.');
  }
}

boot();
