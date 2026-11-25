import { api } from '/js/api.js';
import { escapeHtml, toast } from '/js/util.js';
import { closeModal, confirmDialog, openModal, setBusy } from '../ui.js';

export async function render(root) {
  const { categories } = await api.admin.categories();

  root.innerHTML = `
    <div class="view-head">
      <div>
        <h2>Kategori katalog</h2>
        <p>Kategori mengatur navigasi showroom dan filter katalog pelanggan.</p>
      </div>
      <button class="abtn abtn--primary" type="button" id="newCategory">
        <i class="fa-solid fa-plus"></i> NEW CATEGORY
      </button>
    </div>

    <div class="panel">
      <div class="table-scroll">
        <table class="table">
          <thead>
            <tr>
              <th>Kategori</th>
              <th>Deskripsi</th>
              <th>Produk</th>
              <th>Urutan</th>
              <th style="text-align:right">Aksi</th>
            </tr>
          </thead>
          <tbody id="categoryRows">
            ${
              categories
                .map(
                  (category) => `
              <tr>
                <td>
                  <div class="cell-product">
                    <span class="icon-action" style="pointer-events:none"><i class="fa-solid ${escapeHtml(
                      category.icon || 'fa-shoe-prints'
                    )}"></i></span>
                    <div>
                      <strong>${escapeHtml(category.name)}</strong>
                      <span>/${escapeHtml(category.slug)}</span>
                    </div>
                  </div>
                </td>
                <td style="color:var(--muted)">${escapeHtml(category.tagline || '—')}</td>
                <td class="num">${category.productCount}</td>
                <td class="num">${category.sortOrder}</td>
                <td>
                  <div class="table-actions">
                    <button class="icon-action" type="button" data-edit="${category.id}" aria-label="Edit ${escapeHtml(
                      category.name
                    )}"><i class="fa-solid fa-pen"></i></button>
                    <button class="icon-action is-danger" type="button" data-delete="${category.id}" aria-label="Hapus ${escapeHtml(
                      category.name
                    )}"><i class="fa-solid fa-trash"></i></button>
                  </div>
                </td>
              </tr>`
                )
                .join('') || '<tr><td colspan="5"><div class="empty-note">Belum ada kategori.</div></td></tr>'
            }
          </tbody>
        </table>
      </div>
    </div>`;

  root.querySelector('#newCategory').addEventListener('click', () => openForm(null, root));

  root.querySelector('#categoryRows').addEventListener('click', async (event) => {
    const edit = event.target.closest('[data-edit]');
    const remove = event.target.closest('[data-delete]');

    if (edit) {
      const category = categories.find((item) => item.id === Number(edit.dataset.edit));
      if (category) openForm(category, root);
    }

    if (remove) {
      const category = categories.find((item) => item.id === Number(remove.dataset.delete));
      if (!category) return;
      const confirmed = await confirmDialog({
        title: 'Hapus kategori?',
        message: `Kategori “${category.name}” akan dihapus. Kategori yang masih memiliki produk tidak dapat dihapus.`,
        confirmLabel: 'HAPUS KATEGORI',
      });
      if (!confirmed) return;
      try {
        await api.admin.deleteCategory(category.id);
        toast('Kategori berhasil dihapus.');
        await render(root);
      } catch (error) {
        toast(error.message, 'error');
      }
    }
  });
}

const ICONS = [
  'fa-shoe-prints',
  'fa-person-running',
  'fa-basketball',
  'fa-person-skateboarding',
  'fa-star',
  'fa-gem',
  'fa-layer-group',
  'fa-fire',
];

function openForm(category, root) {
  const isEdit = Boolean(category);
  const card = openModal(
    `
    <div class="admin-modal__head">
      <div>
        <p class="kicker">Catalog</p>
        <h3>${isEdit ? 'Edit kategori' : 'Kategori baru'}</h3>
        <p>Nama kategori langsung muncul di navigasi dan filter showroom.</p>
      </div>
      <button class="modal-close" type="button" data-close-modal aria-label="Tutup">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
    <form id="categoryForm" class="aform" novalidate>
      <div class="afield">
        <label for="cName">Nama kategori *</label>
        <input class="input" id="cName" name="name" type="text" maxlength="60" required value="${escapeHtml(
          category?.name || ''
        )}">
      </div>
      <div class="afield">
        <label for="cSort">Urutan tampil</label>
        <input class="input" id="cSort" name="sortOrder" type="number" min="0" max="999" value="${
          category?.sortOrder ?? 0
        }">
      </div>
      <div class="afield">
        <label for="cIcon">Ikon</label>
        <select class="select" id="cIcon" name="icon">
          ${ICONS.map(
            (icon) =>
              `<option value="${icon}" ${category?.icon === icon ? 'selected' : ''}>${icon.replace(
                'fa-',
                ''
              )}</option>`
          ).join('')}
        </select>
      </div>
      <div class="afield">
        <label for="cTagline">Tagline</label>
        <input class="input" id="cTagline" name="tagline" type="text" maxlength="120" placeholder="Engineered for the long run" value="${escapeHtml(
          category?.tagline || ''
        )}">
      </div>
      <p class="form-error span-2" id="categoryError" style="grid-column:1/-1"></p>
      <div class="form-actions">
        <button class="abtn abtn--ghost" type="button" data-close-modal>BATAL</button>
        <button class="abtn abtn--primary" type="submit">${
          isEdit ? 'SIMPAN PERUBAHAN' : 'TAMBAH KATEGORI'
        } <i class="fa-solid fa-check"></i></button>
      </div>
    </form>`,
    { small: true }
  );

  if (!card) return;
  const form = card.querySelector('#categoryForm');
  const errorNode = card.querySelector('#categoryError');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = {
      name: form.querySelector('#cName').value.trim(),
      tagline: form.querySelector('#cTagline').value.trim(),
      icon: form.querySelector('#cIcon').value,
      sortOrder: Number(form.querySelector('#cSort').value) || 0,
    };
    if (!payload.name) {
      errorNode.textContent = 'Nama kategori wajib diisi.';
      return;
    }

    const submit = form.querySelector('[type="submit"]');
    setBusy(submit, true, 'MENYIMPAN…');
    try {
      if (isEdit) await api.admin.updateCategory(category.id, payload);
      else await api.admin.createCategory(payload);
      toast(isEdit ? 'Kategori berhasil diperbarui.' : 'Kategori berhasil ditambahkan.');
      closeModal();
      await render(root);
    } catch (error) {
      errorNode.textContent = error.message;
      setBusy(submit, false);
    }
  });
}
