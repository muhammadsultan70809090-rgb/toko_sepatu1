import { api } from './api.js';
import { productCard } from './card.js';
import { initShell } from './site.js';
import { escapeHtml, initReveal, rupiah, toast } from './util.js';

const $ = (selector, context = document) => context.querySelector(selector);

const state = {
  products: [],
  categories: [],
  settings: {},
  filters: { search: '', category: 'All', size: '', color: '', sort: 'featured' },
};

function heroTitleMarkup(raw) {
  const title = String(raw || 'FIND YOUR OWN STEP.').trim();
  const words = title.split(/\s+/);
  if (words.length >= 3) {
    return `${escapeHtml(words.slice(0, -2).join(' '))}<br><em>${escapeHtml(
      words.slice(-2).join(' ')
    )}</em>`;
  }
  if (words.length === 2) {
    return `${escapeHtml(words[0])}<br><em>${escapeHtml(words[1])}</em>`;
  }
  return escapeHtml(title);
}

function renderHero() {
  const settings = state.settings;
  const featured = state.products.find((product) => product.featured) || state.products[0];

  const eyebrow = $('#heroEyebrow');
  if (eyebrow && settings.heroEyebrow) eyebrow.textContent = settings.heroEyebrow;

  const title = $('#heroTitle');
  if (title && settings.heroTitle) title.innerHTML = heroTitleMarkup(settings.heroTitle);

  const sub = $('#heroSub');
  if (sub && settings.heroSubtitle) sub.textContent = settings.heroSubtitle;

  const image = $('#heroImage');
  if (image) {
    image.src = settings.heroImage || featured?.image || '/assets/placeholder.svg';
    image.alt = featured ? `${featured.name} oleh ${featured.brand}` : 'Sneaker unggulan SneakerSpace';
  }

  const caption = $('#heroCaption');
  if (caption) {
    caption.textContent = `AW26 CAMPAIGN — ${featured ? featured.brand.toUpperCase() : 'JAKARTA'}`;
  }

  if (featured) {
    const brand = $('#heroFeatureBrand');
    const name = $('#heroFeatureName');
    const price = $('#heroFeaturePrice');
    const link = $('#heroFeature');
    const metaName = $('#heroFeaturedName');
    if (brand) brand.textContent = featured.brand;
    if (name) name.textContent = featured.name;
    if (price) price.textContent = `${rupiah(featured.price)} · ${featured.category || ''}`;
    if (link) link.href = `/produk/${featured.id}`;
    if (metaName) metaName.textContent = featured.name;
  }
}

function renderCategories() {
  const grid = $('#categoryGrid');
  if (!grid) return;
  grid.innerHTML = state.categories
    .map((category, index) => {
      const sample = state.products.find((product) => product.category === category.name);
      return `
        <a class="cat" href="#collection" data-category="${escapeHtml(category.name)}" data-reveal>
          <img class="cat__img" src="${escapeHtml(
            sample?.image || state.settings.bannerImage || '/assets/placeholder.svg'
          )}" alt="" loading="lazy" aria-hidden="true">
          <span class="cat__num">${String(index + 1).padStart(2, '0')}</span>
          <div class="cat__body">
            <span class="cat__count">${category.productCount || 0} pieces</span>
            <h3>${escapeHtml(category.name)}</h3>
            <p>${escapeHtml(category.tagline || 'Curated silhouettes')}</p>
          </div>
          <span class="cat__arrow"><i class="fa-solid fa-arrow-right-long"></i></span>
        </a>`;
    })
    .join('');

  grid.addEventListener('click', (event) => {
    const card = event.target.closest('.cat');
    if (!card) return;
    const category = card.dataset.category;
    if (!category) return;
    event.preventDefault();
    state.filters.category = category;
    const select = $('#categoryFilter');
    if (select) select.value = category;
    renderProducts();
    $('#collection')?.scrollIntoView({ behavior: 'smooth' });
  });
}

function renderRack() {
  const rack = $('#rack');
  if (!rack) return;
  rack.innerHTML = state.products
    .map(
      (product, index) => `
      <a class="rack-card" href="/produk/${product.id}">
        <div class="rack-card__media">
          <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy">
          <span class="rack-card__index">${String(index + 1).padStart(2, '0')}</span>
          <span class="rack-card__cta"><span>View piece</span><i class="fa-solid fa-arrow-right-long"></i></span>
        </div>
        <div class="rack-card__meta">
          <span class="rack-card__brand">${escapeHtml(product.brand)}</span>
          <h3>${escapeHtml(product.name)}</h3>
          <span class="rack-card__price">${rupiah(product.price)}</span>
        </div>
      </a>`
    )
    .join('');
}

function populateFilters() {
  const categorySelect = $('#categoryFilter');
  if (categorySelect) {
    categorySelect.innerHTML = ['<option value="All">All categories</option>']
      .concat(
        state.categories.map(
          (category) => `<option value="${escapeHtml(category.name)}">${escapeHtml(category.name)}</option>`
        )
      )
      .join('');
  }

  const sizes = [
    ...new Set(state.products.flatMap((product) => product.sizes.map((row) => Number(row.size)))),
  ].sort((a, b) => a - b);
  const sizeSelect = $('#sizeFilter');
  if (sizeSelect) {
    sizeSelect.innerHTML = ['<option value="">All sizes</option>']
      .concat(sizes.map((size) => `<option value="${size}">EU ${size}</option>`))
      .join('');
  }

  const colorNames = [
    ...new Set(state.products.flatMap((product) => product.colors.map((color) => color.name))),
  ].sort((a, b) => a.localeCompare(b));
  const colorSelect = $('#colorFilter');
  if (colorSelect) {
    colorSelect.innerHTML = ['<option value="">All colours</option>']
      .concat(colorNames.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`))
      .join('');
  }
}

function filteredProducts() {
  const { search, category, size, color, sort } = state.filters;
  const keyword = search.trim().toLowerCase();
  let rows = state.products.filter((product) => {
    const matchSearch =
      !keyword ||
      product.name.toLowerCase().includes(keyword) ||
      product.brand.toLowerCase().includes(keyword) ||
      (product.category || '').toLowerCase().includes(keyword);
    const matchCategory = category === 'All' || product.category === category;
    const matchSize = !size || product.sizes.some((row) => Number(row.size) === Number(size));
    const matchColor =
      !color || product.colors.some((entry) => entry.name.toLowerCase() === color.toLowerCase());
    return matchSearch && matchCategory && matchSize && matchColor;
  });

  if (sort === 'low') rows = [...rows].sort((a, b) => a.price - b.price);
  if (sort === 'high') rows = [...rows].sort((a, b) => b.price - a.price);
  if (sort === 'newest') rows = [...rows].sort((a, b) => b.id - a.id);
  if (sort === 'name') rows = [...rows].sort((a, b) => a.name.localeCompare(b.name));
  return rows;
}

function renderProducts() {
  const grid = $('#productGrid');
  if (!grid) return;
  const rows = filteredProducts();

  const countLabel = $('#resultCount');
  if (countLabel) countLabel.textContent = `${rows.length} piece${rows.length === 1 ? '' : 's'} available`;

  const active = [];
  if (state.filters.search) active.push(`“${state.filters.search}”`);
  if (state.filters.category !== 'All') active.push(state.filters.category);
  if (state.filters.size) active.push(`EU ${state.filters.size}`);
  if (state.filters.color) active.push(state.filters.color);
  const activeNode = $('#activeFilters');
  if (activeNode) activeNode.textContent = active.length ? `Filtered by ${active.join(' · ')}` : '';

  if (!rows.length) {
    grid.innerHTML = `
      <div class="empty">
        <h3>No pieces matched.</h3>
        <p>Coba kata kunci lain, atau reset filter untuk melihat seluruh koleksi.</p>
        <button class="btn btn--ink" type="button" data-reset-filters>RESET FILTERS</button>
      </div>`;
    return;
  }

  grid.innerHTML = rows.map((product) => productCard(product)).join('');
  initReveal();
}

function initFilters() {
  const search = $('#searchInput');
  search?.addEventListener('input', () => {
    state.filters.search = search.value;
    renderProducts();
  });

  $('#categoryFilter')?.addEventListener('change', (event) => {
    state.filters.category = event.target.value;
    renderProducts();
  });
  $('#sizeFilter')?.addEventListener('change', (event) => {
    state.filters.size = event.target.value;
    renderProducts();
  });
  $('#colorFilter')?.addEventListener('change', (event) => {
    state.filters.color = event.target.value;
    renderProducts();
  });
  $('#sortFilter')?.addEventListener('change', (event) => {
    state.filters.sort = event.target.value;
    renderProducts();
  });

  const reset = () => {
    state.filters = { search: '', category: 'All', size: '', color: '', sort: 'featured' };
    if (search) search.value = '';
    ['#categoryFilter', '#sizeFilter', '#colorFilter', '#sortFilter'].forEach((selector) => {
      const node = $(selector);
      if (!node) return;
      node.value = selector === '#categoryFilter' ? 'All' : selector === '#sortFilter' ? 'featured' : '';
    });
    renderProducts();
  };

  $('#resetFilters')?.addEventListener('click', reset);
  $('#productGrid')?.addEventListener('click', (event) => {
    if (event.target.closest('[data-reset-filters]')) reset();
  });
}

function renderCampaign() {
  const image = $('#campaignImage');
  if (!image) return;
  const featured = state.products.find((product) => product.featured) || state.products[0];
  image.src =
    state.settings.bannerImage || featured?.image || '/assets/placeholder.svg';
  image.alt = 'Kampanye sneaker SneakerSpace AW26';
}

function initRack() {
  const rack = $('#rack');
  const bar = $('#rackBar');
  if (!rack) return;

  const updateBar = () => {
    if (!bar) return;
    const max = rack.scrollWidth - rack.clientWidth;
    const progress = max > 0 ? (rack.scrollLeft / max) * 100 : 0;
    bar.style.width = `${Math.max(8, progress)}%`;
  };

  $('#rackPrev')?.addEventListener('click', () => {
    rack.scrollBy({ left: -rack.clientWidth * 0.8, behavior: 'smooth' });
  });
  $('#rackNext')?.addEventListener('click', () => {
    rack.scrollBy({ left: rack.clientWidth * 0.8, behavior: 'smooth' });
  });

  rack.addEventListener('scroll', updateBar, { passive: true });
  window.addEventListener('resize', updateBar);
  updateBar();

  let dragging = false;
  let startX = 0;
  let startScroll = 0;
  let moved = 0;

  rack.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'mouse') return;
    dragging = true;
    moved = 0;
    startX = event.clientX;
    startScroll = rack.scrollLeft;
    rack.classList.add('is-dragging');
  });
  window.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const delta = event.clientX - startX;
    if (Math.abs(delta) > 4) moved = 1;
    rack.scrollLeft = startScroll - delta;
  });
  window.addEventListener('pointerup', () => {
    if (!dragging) return;
    dragging = false;
    rack.classList.remove('is-dragging');
    if (moved) {
      rack.dataset.blockClick = '1';
      setTimeout(() => delete rack.dataset.blockClick, 60);
    }
  });
  rack.addEventListener(
    'click',
    (event) => {
      if (rack.dataset.blockClick) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    true
  );
}

function showLoadError() {
  const grid = $('#productGrid');
  if (grid) {
    grid.innerHTML = `
      <div class="empty">
        <h3>Katalog belum dapat dimuat.</h3>
        <p>Periksa koneksi Anda, lalu muat ulang halaman ini.</p>
        <button class="btn btn--ink" type="button" onclick="location.reload()">MUAT ULANG</button>
      </div>`;
  }
  toast('Tidak dapat memuat katalog dari server.', 'error');
}

async function boot() {
  const grid = $('#productGrid');
  if (grid) {
    grid.innerHTML = Array.from({ length: 8 })
      .map(() => '<div class="skeleton" aria-hidden="true"></div>')
      .join('');
  }

  try {
    const data = await api.store();
    state.products = data.products;
    state.categories = data.categories;
    state.settings = data.settings;

    document.title = `${data.settings.storeName || 'SneakerSpace'} — Digital Sneaker Showroom`;

    initShell(data.settings);
    renderHero();
    renderCategories();
    renderRack();
    renderCampaign();
    populateFilters();
    initFilters();
    renderProducts();
    initRack();
  } catch (error) {
    console.error(error);
    showLoadError();
  }
}

boot();
