import { api } from '/js/api.js';
import { escapeHtml, rupiah, toast } from '/js/util.js';
import {
  closeModal,
  confirmDialog,
  imageUrl,
  openModal,
  productPill,
  setBusy,
} from '../ui.js';

let cache = { products: [], categories: [] };

export async function render(root) {
  const [productData, categoryData] = await Promise.all([
    api.admin.products(),
    api.admin.categories(),
  ]);
  cache = { products: productData.products, categories: categoryData.categories };

  root.innerHTML = `
    <div class="view-head">
      <div>
        <h2>Katalog produk</h2>
        <p>Kelola seluruh produk SneakerSpace. Setiap perubahan langsung tampil di website pelanggan.</p>
      </div>
      <button class="abtn abtn--primary" type="button" id="newProduct">
        <i class="fa-solid fa-plus"></i> NEW PRODUCT
      </button>
    </div>

    <div class="panel">
      <div class="table-tools">
        <input class="input" id="productSearch" type="search" placeholder="Cari nama atau merek…" autocomplete="off">
        <select class="select" id="productFilterCategory">
          <option value="">Semua kategori</option>
          ${cache.categories
            .map(
              (category) =>
                `<option value="${escapeHtml(category.name)}">${escapeHtml(category.name)}</option>`
            )
            .join('')}
        </select>
        <select class="select" id="productFilterStatus">
          <option value="">Semua status</option>
          <option value="active">Aktif</option>
          <option value="draft">Draft</option>
        </select>
        <span class="table-tools__spacer"></span>
        <span style="font-size:10.5px;color:var(--muted)" id="productCount"></span>
      </div>
      <div class="table-scroll">
        <table class="table">
          <thead>
            <tr>
              <th>Produk</th>
              <th>Kategori</th>
              <th>Harga</th>
              <th>Stok</th>
              <th>Status</th>
              <th style="text-align:right">Aksi</th>
            </tr>
          </thead>
          <tbody id="productRows"></tbody>
        </table>
      </div>
    </div>`;

  const tbody = root.querySelector('#productRows');

  const paint = () => {
    const keyword = root.querySelector('#productSearch').value.trim().toLowerCase();
    const category = root.querySelector('#productFilterCategory').value;
    const status = root.querySelector('#productFilterStatus').value;

    const rows = cache.products.filter((product) => {
      const matchKeyword =
        !keyword ||
        product.name.toLowerCase().includes(keyword) ||
        product.brand.toLowerCase().includes(keyword);
      const matchCategory = !category || product.category === category;
      const matchStatus = !status || product.status === status;
      return matchKeyword && matchCategory && matchStatus;
    });

    root.querySelector('#productCount').textContent = `${rows.length} dari ${cache.products.length} produk`;

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty-note"><i class="fa-solid fa-box-open"></i>Belum ada produk yang cocok. Tambahkan produk baru untuk memulai.</div></td></tr>`;
      return;
    }

    tbody.innerHTML = rows
      .map(
        (product) => `
        <tr>
          <td>
            <div class="cell-product">
              <img class="thumb" src="${escapeHtml(imageUrl(product.image))}" alt="">
              <div>
                <strong>${escapeHtml(product.name)}</strong>
                <span>${escapeHtml(product.brand)}${product.badge ? ` · ${escapeHtml(product.badge)}` : ''}${
                  product.featured ? ' · Featured' : ''
                }</span>
              </div>
            </div>
          </td>
          <td>${escapeHtml(product.category || '—')}</td>
          <td class="num">${rupiah(product.price)}</td>
          <td class="num">${product.stock}</td>
          <td>${productPill(product)}</td>
          <td>
            <div class="table-actions">
              <button class="icon-action" type="button" data-edit="${product.id}" aria-label="Edit ${escapeHtml(product.name)}" title="Edit">
                <i class="fa-solid fa-pen"></i>
              </button>
              <button class="icon-action is-danger" type="button" data-delete="${product.id}" aria-label="Hapus ${escapeHtml(product.name)}" title="Hapus">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>`
      )
      .join('');
  };

  paint();

  root.querySelector('#productSearch').addEventListener('input', paint);
  root.querySelector('#productFilterCategory').addEventListener('change', paint);
  root.querySelector('#productFilterStatus').addEventListener('change', paint);
  root.querySelector('#newProduct').addEventListener('click', () => openForm(null, root));

  tbody.addEventListener('click', async (event) => {
    const editButton = event.target.closest('[data-edit]');
    const deleteButton = event.target.closest('[data-delete]');

    if (editButton) {
      const product = cache.products.find((item) => item.id === Number(editButton.dataset.edit));
      if (product) openForm(product, root);
    }

    if (deleteButton) {
      const product = cache.products.find((item) => item.id === Number(deleteButton.dataset.delete));
      if (!product) return;
      const confirmed = await confirmDialog({
        title: 'Hapus produk?',
        message: `${product.name} akan dihapus dari katalog dan showroom. Riwayat pesanan tetap tersimpan.`,
        confirmLabel: 'HAPUS PRODUK',
      });
      if (!confirmed) return;
      try {
        await api.admin.deleteProduct(product.id);
        toast('Produk berhasil dihapus.');
        await render(root);
      } catch (error) {
        toast(error.message, 'error');
      }
    }
  });
}

function openForm(product, root) {
  const isEdit = Boolean(product);
  const state = {
    image: product?.image || '',
    spinFrames: product ? [...product.spinFrames] : [],
    sizes: product
      ? product.sizes.map((row) => ({ ...row }))
      : [
          { size: 40, stock: 0 },
          { size: 41, stock: 0 },
          { size: 42, stock: 0 },
        ],
    colors: product ? product.colors.map((color) => ({ ...color })) : [{ name: 'Black', hex: '#242321' }],
  };

  const categoryOptions = cache.categories
    .map(
      (category) =>
        `<option value="${category.id}" ${
          product?.categoryId === category.id ? 'selected' : ''
        }>${escapeHtml(category.name)}</option>`
    )
    .join('');

  const card = openModal(`
    <div class="admin-modal__head">
      <div>
        <p class="kicker">Catalog</p>
        <h3>${isEdit ? 'Edit produk' : 'Produk baru'}</h3>
        <p>Produk aktif langsung muncul di katalog dan showroom pelanggan.</p>
      </div>
      <button class="modal-close" type="button" data-close-modal aria-label="Tutup">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>

    <form id="productForm" class="aform" novalidate>
      <div class="afield span-2">
        <label>Foto produk</label>
        <div class="image-field">
          <div class="image-preview"><img id="imagePreview" src="${escapeHtml(imageUrl(state.image))}" alt=""></div>
          <div class="image-field__actions">
            <input type="file" id="imageFile" accept="image/jpeg,image/png,image/webp,image/avif" hidden>
            <button class="abtn abtn--ghost" type="button" id="pickImage"><i class="fa-solid fa-upload"></i> UPLOAD FOTO</button>
            <input class="input" id="imageUrl" type="text" placeholder="atau tempel URL gambar" value="${escapeHtml(state.image)}">
            <p class="image-field__hint">JPG / PNG / WEBP, maksimal 6MB. Rasio portrait paling optimal.</p>
          </div>
        </div>
      </div>

      <div class="afield">
        <label for="pName">Nama produk *</label>
        <input class="input" id="pName" name="name" type="text" maxlength="120" required value="${escapeHtml(product?.name || '')}">
      </div>
      <div class="afield">
        <label for="pBrand">Merek *</label>
        <input class="input" id="pBrand" name="brand" type="text" maxlength="80" required value="${escapeHtml(product?.brand || '')}">
      </div>
      <div class="afield">
        <label for="pCategory">Kategori *</label>
        <select class="select" id="pCategory" name="categoryId">${categoryOptions}</select>
      </div>
      <div class="afield">
        <label for="pPrice">Harga (Rp) *</label>
        <input class="input" id="pPrice" name="price" type="number" min="0" max="500000000" step="1000" required value="${product?.price ?? 0}">
      </div>
      <div class="afield">
        <label for="pBadge">Badge / label</label>
        <input class="input" id="pBadge" name="badge" type="text" maxlength="30" placeholder="NEW, LIMITED, ICON…" value="${escapeHtml(product?.badge || '')}">
      </div>
      <div class="afield">
        <label for="pStatus">Status produk</label>
        <select class="select" id="pStatus" name="status">
          <option value="active" ${product?.status !== 'draft' ? 'selected' : ''}>Aktif — tampil di toko</option>
          <option value="draft" ${product?.status === 'draft' ? 'selected' : ''}>Draft — disembunyikan</option>
        </select>
      </div>
      <div class="afield span-2">
        <label for="pMaterial">Material</label>
        <input class="input" id="pMaterial" name="material" type="text" maxlength="160" placeholder="Contoh: Full-grain leather, rubber cupsole" value="${escapeHtml(product?.material || '')}">
      </div>
      <div class="afield span-2">
        <label for="pDescription">Deskripsi</label>
        <textarea class="textarea" id="pDescription" name="description" maxlength="2000">${escapeHtml(product?.description || '')}</textarea>
      </div>
      <div class="afield span-2">
        <label class="checkbox"><input type="checkbox" name="featured" ${product?.featured ? 'checked' : ''}> Tampilkan sebagai produk unggulan</label>
      </div>

      <div class="form-section span-2">
        <div><h4>Ukuran &amp; stok</h4><p>Stok total dihitung otomatis dari setiap ukuran.</p></div>
        <button class="abtn abtn--ghost abtn--sm" type="button" id="addSize"><i class="fa-solid fa-plus"></i> ADD SIZE</button>
      </div>
      <div class="span-2">
        <div class="editor-rows" id="sizeRows"></div>
        <div class="editor-note">Total stok: <strong id="totalStock">0</strong> pasang</div>
      </div>

      <div class="form-section span-2">
        <div><h4>Warna</h4><p>Pilihan warna yang tampil di halaman detail.</p></div>
        <button class="abtn abtn--ghost abtn--sm" type="button" id="addColor"><i class="fa-solid fa-plus"></i> ADD COLOUR</button>
      </div>
      <div class="span-2">
        <div class="editor-rows" id="colorRows"></div>
      </div>

      <div class="form-section span-2">
        <div><h4>360° spin frames</h4><p>Unggah 24–36 foto berurutan dari berbagai sudut agar sepatu benar-benar dapat diputar.</p></div>
        <div>
          <input type="file" id="framesFile" accept="image/jpeg,image/png,image/webp,image/avif" multiple hidden>
          <button class="abtn abtn--ghost abtn--sm" type="button" id="pickFrames"><i class="fa-solid fa-images"></i> UPLOAD FRAMES</button>
        </div>
      </div>
      <div class="span-2">
        <div class="frame-strip" id="frameStrip"></div>
        <p class="editor-note" id="frameNote"></p>
      </div>

      <p class="form-error span-2" id="productError" style="grid-column:1/-1"></p>

      <div class="form-actions">
        <button class="abtn abtn--ghost" type="button" data-close-modal>BATAL</button>
        <button class="abtn abtn--primary" type="submit">
          ${isEdit ? 'SIMPAN PERUBAHAN' : 'TAMBAH PRODUK'} <i class="fa-solid fa-check"></i>
        </button>
      </div>
    </form>`);

  if (!card) return;

  const form = card.querySelector('#productForm');
  const sizeRows = card.querySelector('#sizeRows');
  const colorRows = card.querySelector('#colorRows');
  const totalStock = card.querySelector('#totalStock');
  const errorNode = card.querySelector('#productError');

  const syncSizes = () => {
    state.sizes = [...sizeRows.querySelectorAll('.size-row')].map((row) => ({
      size: Number(row.querySelector('[data-role="size"]').value),
      stock: Number(row.querySelector('[data-role="stock"]').value),
    }));
  };

  const updateTotal = () => {
    const total = [...sizeRows.querySelectorAll('[data-role="stock"]')].reduce(
      (sum, input) => sum + (Number(input.value) || 0),
      0
    );
    totalStock.textContent = total;
  };

  const paintSizes = () => {
    sizeRows.innerHTML = state.sizes
      .map(
        (row, index) => `
        <div class="size-row" data-index="${index}">
          <input class="input" type="number" min="30" max="50" data-role="size" value="${row.size}" aria-label="Ukuran EU">
          <input class="input" type="number" min="0" max="10000" data-role="stock" value="${row.stock}" aria-label="Stok ukuran">
          <button class="icon-action is-danger" type="button" data-remove-size="${index}" aria-label="Hapus ukuran">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>`
      )
      .join('');
    updateTotal();
  };

  const paintColors = () => {
    colorRows.innerHTML = state.colors
      .map(
        (color, index) => `
        <div class="color-row" data-index="${index}">
          <input class="input" type="text" maxlength="40" data-role="color-name" value="${escapeHtml(color.name)}" aria-label="Nama warna" placeholder="Nama warna">
          <input type="color" data-role="color-hex" value="${escapeHtml(color.hex)}" aria-label="Kode warna">
          <button class="icon-action is-danger" type="button" data-remove-color="${index}" aria-label="Hapus warna">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>`
      )
      .join('');
  };

  const syncColors = () => {
    state.colors = [...colorRows.querySelectorAll('.color-row')].map((row) => ({
      name: row.querySelector('[data-role="color-name"]').value.trim(),
      hex: row.querySelector('[data-role="color-hex"]').value,
    }));
  };

  const paintFrames = () => {
    const strip = card.querySelector('#frameStrip');
    const note = card.querySelector('#frameNote');
    strip.innerHTML = state.spinFrames.length
      ? state.spinFrames
          .map(
            (url, index) => `
            <div class="frame-thumb">
              <img src="${escapeHtml(url)}" alt="">
              <button type="button" data-remove-frame="${index}" aria-label="Hapus frame"><i class="fa-solid fa-xmark"></i></button>
            </div>`
          )
          .join('')
      : '<span class="frame-empty">Belum ada frame. Viewer akan memakai simulasi turntable.</span>';
    note.textContent = `${state.spinFrames.length} frame terunggah${
      state.spinFrames.length >= 2 ? ' — rotasi 360° foto aktif.' : '.'
    }`;
  };

  paintSizes();
  paintColors();
  paintFrames();

  sizeRows.addEventListener('input', updateTotal);
  sizeRows.addEventListener('click', (event) => {
    const remove = event.target.closest('[data-remove-size]');
    if (!remove) return;
    syncSizes();
    state.sizes.splice(Number(remove.dataset.removeSize), 1);
    paintSizes();
  });

  card.querySelector('#addSize').addEventListener('click', () => {
    syncSizes();
    if (state.sizes.length >= 16) {
      toast('Maksimal 16 ukuran per produk.', 'error');
      return;
    }
    const max = state.sizes.reduce((value, row) => Math.max(value, row.size), 39);
    state.sizes.push({ size: Math.min(50, max + 1), stock: 0 });
    paintSizes();
  });

  colorRows.addEventListener('click', (event) => {
    const remove = event.target.closest('[data-remove-color]');
    if (!remove) return;
    syncColors();
    state.colors.splice(Number(remove.dataset.removeColor), 1);
    paintColors();
  });

  card.querySelector('#addColor').addEventListener('click', () => {
    syncColors();
    state.colors.push({ name: '', hex: '#d2a7a3' });
    paintColors();
  });

  card.querySelector('#frameStrip').addEventListener('click', (event) => {
    const remove = event.target.closest('[data-remove-frame]');
    if (!remove) return;
    state.spinFrames.splice(Number(remove.dataset.removeFrame), 1);
    paintFrames();
  });

  /* image upload */
  const imageFile = card.querySelector('#imageFile');
  const imagePreview = card.querySelector('#imagePreview');
  const imageUrlInput = card.querySelector('#imageUrl');

  card.querySelector('#pickImage').addEventListener('click', () => imageFile.click());
  imageFile.addEventListener('change', async () => {
    const file = imageFile.files?.[0];
    if (!file) return;
    const button = card.querySelector('#pickImage');
    setBusy(button, true, 'MENGUNGGAH…');
    try {
      const [url] = await api.upload([file]);
      state.image = url;
      imagePreview.src = url;
      imageUrlInput.value = url;
      toast('Foto produk berhasil diunggah.');
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setBusy(button, false);
      imageFile.value = '';
    }
  });

  const syncImageUrl = () => {
    state.image = imageUrlInput.value.trim();
    imagePreview.src = imageUrl(state.image);
  };
  imageUrlInput.addEventListener('input', syncImageUrl);
  imageUrlInput.addEventListener('change', syncImageUrl);

  /* spin frames upload */
  const framesFile = card.querySelector('#framesFile');
  card.querySelector('#pickFrames').addEventListener('click', () => framesFile.click());
  framesFile.addEventListener('change', async () => {
    const files = [...(framesFile.files || [])];
    if (!files.length) return;
    const button = card.querySelector('#pickFrames');
    setBusy(button, true, 'MENGUNGGAH…');
    try {
      const urls = await api.upload(files.slice(0, 40));
      state.spinFrames.push(...urls);
      paintFrames();
      toast(`${urls.length} frame ditambahkan.`);
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setBusy(button, false);
      framesFile.value = '';
    }
  });

  /* submit */
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorNode.textContent = '';
    syncSizes();
    syncColors();

    const payload = {
      name: form.querySelector('#pName').value.trim(),
      brand: form.querySelector('#pBrand').value.trim(),
      categoryId: Number(form.querySelector('#pCategory').value),
      price: Number(form.querySelector('#pPrice').value),
      badge: form.querySelector('#pBadge').value.trim(),
      status: form.querySelector('#pStatus').value,
      material: form.querySelector('#pMaterial').value.trim(),
      description: form.querySelector('#pDescription').value.trim(),
      featured: form.querySelector('[name="featured"]').checked,
      image: state.image.trim(),
      sizes: state.sizes.filter((row) => Number.isFinite(row.size) && row.size >= 30 && row.size <= 50),
      colors: state.colors.filter((color) => color.name),
      spinFrames: state.spinFrames,
    };

    if (!payload.name) return (errorNode.textContent = 'Nama produk wajib diisi.');
    if (!payload.brand) return (errorNode.textContent = 'Merek wajib diisi.');
    if (!payload.categoryId) return (errorNode.textContent = 'Pilih kategori produk.');
    if (!Number.isFinite(payload.price) || payload.price < 0) {
      return (errorNode.textContent = 'Harga harus berupa angka yang valid.');
    }
    if (!payload.sizes.length) {
      return (errorNode.textContent = 'Tambahkan minimal satu ukuran EU.');
    }
    if (!payload.colors.length) {
      return (errorNode.textContent = 'Tambahkan minimal satu warna.');
    }

    const submit = form.querySelector('[type="submit"]');
    setBusy(submit, true, 'MENYIMPAN…');
    try {
      if (isEdit) {
        await api.admin.updateProduct(product.id, payload);
        toast('Produk berhasil diperbarui.');
      } else {
        await api.admin.createProduct(payload);
        toast('Produk baru berhasil ditambahkan.');
      }
      closeModal();
      await render(root);
    } catch (error) {
      errorNode.textContent = error.message;
      setBusy(submit, false);
    }
  });
}
