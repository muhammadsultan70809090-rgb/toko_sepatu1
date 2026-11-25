import { api } from '/js/api.js';
import { escapeHtml, toast } from '/js/util.js';
import { createFrameManager } from '../frames-ui.js';

export async function render(root) {
  const { products } = await api.admin.products();

  root.innerHTML = `
    <div class="view-head">
      <div>
        <h2>360° Image Manager</h2>
        <p>Unggah 24–36 foto berurutan untuk setiap produk, atur urutannya, lalu periksa putarannya sebelum tampil di halaman pelanggan.</p>
      </div>
      <span class="frames-save" id="framesSave">Siap</span>
    </div>

    <div class="panel">
      <div class="frames-picker">
        <label for="framesProduct">Produk</label>
        <select class="select" id="framesProduct">
          ${products
            .map(
              (product) =>
                `<option value="${product.id}">${escapeHtml(product.name)} — ${escapeHtml(
                  product.brand
                )} (${product.spinFrames.length} frame)</option>`
            )
            .join('')}
        </select>
        <div class="frames-picker__meta" id="framesMeta"></div>
      </div>
      ${
        products.length
          ? '<div id="framesMount"></div>'
          : '<div class="empty-note"><i class="fa-solid fa-box-open"></i>Belum ada produk. Tambahkan produk terlebih dahulu di menu Products.</div>'
      }
      <p class="frames-storage" id="framesStorage"></p>
    </div>`;

  if (!products.length) return;

  const select = root.querySelector('#framesProduct');
  const mount = root.querySelector('#framesMount');
  const meta = root.querySelector('#framesMeta');
  const saveState = root.querySelector('#framesSave');
  const storageNote = root.querySelector('#framesStorage');

  let selectedId = Number(products[0].id);
  let manager = null;
  let saveChain = Promise.resolve();

  const scheduleSave = (productId, frames) => {
    saveState.textContent = 'Menyimpan…';
    saveState.className = 'frames-save is-saving';
    saveChain = saveChain
      .then(() => api.admin.saveFrames(productId, frames))
      .then(() => {
        saveState.textContent = 'Tersimpan';
        saveState.className = 'frames-save is-saved';
      })
      .catch((error) => {
        saveState.textContent = 'Gagal menyimpan';
        saveState.className = 'frames-save is-error';
        toast(error.message, 'error');
      });
  };

  async function load(productId) {
    selectedId = Number(productId);
    saveState.textContent = 'Memuat…';
    saveState.className = 'frames-save is-saving';
    try {
      const { product } = await api.admin.product(selectedId);
      const productId = selectedId;
      meta.innerHTML = `
        <span>${escapeHtml(product.brand)} · ${escapeHtml(product.category || '—')}</span>
        <span>${product.stock} pasang · ${product.spinFrames.length}/36 frame</span>`;
      mount.innerHTML = '';
      manager = createFrameManager(mount, {
        productId,
        frames: product.spinFrames,
        // Simpan ke produk yang sedang dibuka, bukan ke pilihan select saat ini.
        onChange: (frames) => scheduleSave(productId, frames),
      });
      saveState.textContent = 'Tersimpan';
      saveState.className = 'frames-save is-saved';
    } catch (error) {
      saveState.textContent = 'Gagal memuat';
      saveState.className = 'frames-save is-error';
      toast(error.message, 'error');
    }
  }

  select.addEventListener('change', () => {
    if (manager?.isUploading()) {
      select.value = String(selectedId);
      toast('Tunggu unggahan foto selesai sebelum berpindah produk.', 'error');
      return;
    }
    load(select.value);
  });

  try {
    const health = await api.health();
    const cloud = health?.storage?.provider === 'cloudinary';
    storageNote.className = `frames-storage${cloud ? ' is-cloud' : ''}`;
    storageNote.innerHTML = cloud
      ? '<i class="fa-solid fa-cloud"></i> Foto disimpan permanen di Cloudinary dan disajikan lewat CDN.'
      : '<i class="fa-solid fa-hard-drive"></i> Penyimpanan lokal aktif. Atur CLOUDINARY_* agar foto tetap permanen saat deploy.';
  } catch {
    storageNote.textContent = '';
  }

  history.replaceState(null, '', '#frames');
  await load(selectedId);
}
