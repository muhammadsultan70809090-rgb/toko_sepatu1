import { api } from '/js/api.js';
import { escapeHtml, toast } from '/js/util.js';
import { confirmDialog } from './ui.js';
import { prepareImage } from './image.js';

export const MAX_FRAMES = 36;
const MIN_SMOOTH_FRAMES = 24;

/**
 * 360° Image Manager.
 * Dipakai di menu 360° Image Manager dan di dalam form tambah/edit produk.
 * `onChange` dipanggil setelah urutan berubah; pemanggil yang menentukan
 * apakah perubahan disimpan langsung atau ikut disimpan bersama produk.
 */
export function createFrameManager(mount, { productId = 'draft', frames = [], onChange } = {}) {
  let list = Array.isArray(frames) ? frames.filter(Boolean).slice(0, MAX_FRAMES) : [];
  let current = 0;
  let dragIndex = null;
  let replaceIndex = -1;
  let uploading = false;

  mount.classList.add('frame-manager');
  mount.innerHTML = `
    <div class="frame-manager__head">
      <div class="frame-drop" id="fmDrop" role="button" tabindex="0" aria-label="Tambah foto 360 derajat">
        <i class="fa-solid fa-cloud-arrow-up" aria-hidden="true"></i>
        <strong>Tarik foto ke sini atau klik untuk memilih</strong>
        <span>Hingga 36 foto · JPG / PNG / WEBP · maks 4MB per foto</span>
      </div>
      <input type="file" id="fmInput" accept="image/jpeg,image/png,image/webp" multiple hidden>
      <input type="file" id="fmReplace" accept="image/jpeg,image/png,image/webp" hidden>
      <div class="frame-manager__side">
        <div class="frame-manager__count"><strong id="fmCount">0</strong><span>/ 36 frame</span></div>
        <div class="frame-progress" id="fmProgress" aria-hidden="true"><span id="fmBar"></span></div>
        <p class="frame-manager__status" id="fmStatus"></p>
      </div>
    </div>
    <div class="frame-grid" id="fmGrid"></div>
    <p class="frame-manager__empty" id="fmEmpty"></p>
    <div class="frame-preview">
      <div class="frame-preview__stage" id="fmStage">
        <span class="frame-preview__badge">360° preview</span>
        <img id="fmPreview" alt="Pratinjau putaran 360 derajat" draggable="false">
        <span class="frame-preview__index" id="fmIndex">0 / 0</span>
        <p class="frame-preview__placeholder" id="fmPlaceholder">Belum ada foto untuk diputar.</p>
      </div>
      <div class="frame-preview__controls">
        <button class="viewer__btn" type="button" id="fmPrev" aria-label="Putar ke kiri">
          <i class="fa-solid fa-rotate-left"></i>
        </button>
        <input class="viewer__range" id="fmRange" type="range" min="0" max="0" step="1" value="0"
          aria-label="Pilih sudut foto 360 derajat">
        <button class="viewer__btn" type="button" id="fmNext" aria-label="Putar ke kanan">
          <i class="fa-solid fa-rotate-right"></i>
        </button>
      </div>
      <p class="frame-preview__hint" id="fmHint"></p>
    </div>`;

  const $ = (selector) => mount.querySelector(selector);
  const drop = $('#fmDrop');
  const input = $('#fmInput');
  const replaceInput = $('#fmReplace');
  const grid = $('#fmGrid');
  const empty = $('#fmEmpty');
  const count = $('#fmCount');
  const progress = $('#fmProgress');
  const bar = $('#fmBar');
  const status = $('#fmStatus');
  const stage = $('#fmStage');
  const preview = $('#fmPreview');
  const placeholder = $('#fmPlaceholder');
  const indexLabel = $('#fmIndex');
  const range = $('#fmRange');
  const hint = $('#fmHint');
  const prev = $('#fmPrev');
  const next = $('#fmNext');

  preview.addEventListener('error', () => {
    preview.src = '/assets/placeholder.svg';
  });

  function setStatus(text) {
    status.textContent = text;
  }

  function defaultStatus() {
    const total = list.length;
    if (uploading) return 'Mengunggah foto…';
    if (!total) return 'Belum ada foto. Unggah 24–36 foto berurutan dari sudut berbeda.';
    if (total < MIN_SMOOTH_FRAMES) {
      return `${total} foto tersimpan — minimal ${MIN_SMOOTH_FRAMES} foto agar putaran terlihat mulus.`;
    }
    return `${total} foto siap diputar. Urutan 01–06 depan, 07–12 samping, 13–18 belakang.`;
  }

  function setProgress(ratio) {
    const percent = Math.max(0, Math.min(1, ratio || 0));
    bar.style.width = `${Math.round(percent * 100)}%`;
    progress.classList.toggle('is-active', percent > 0 && percent < 1);
  }

  function paintGrid() {
    count.textContent = String(list.length);
    empty.hidden = list.length > 0;
    empty.textContent = list.length
      ? ''
      : 'Belum ada frame. Tarik 24–36 foto sepatu dari sudut yang berbeda ke area di atas.';

    grid.innerHTML = list
      .map(
        (url, i) => `
        <div class="frame-tile${i === current ? ' is-current' : ''}" draggable="true" data-index="${i}">
          <img src="${escapeHtml(url)}" alt="Frame ${i + 1}" loading="lazy" draggable="false">
          <span class="frame-tile__num">${String(i + 1).padStart(2, '0')}</span>
          <div class="frame-tile__actions">
            <button type="button" data-move="-1" aria-label="Geser frame ${i + 1} ke kiri" title="Geser kiri"><i class="fa-solid fa-arrow-left"></i></button>
            <button type="button" data-move="1" aria-label="Geser frame ${i + 1} ke kanan" title="Geser kanan"><i class="fa-solid fa-arrow-right"></i></button>
            <button type="button" data-replace="${i}" aria-label="Ganti frame ${i + 1}" title="Ganti foto"><i class="fa-solid fa-rotate"></i></button>
            <button type="button" data-remove="${i}" class="is-danger" aria-label="Hapus frame ${i + 1}" title="Hapus"><i class="fa-solid fa-xmark"></i></button>
          </div>
        </div>`
      )
      .join('');

    drop.classList.toggle('is-full', list.length >= MAX_FRAMES);
    setStatus(defaultStatus());
  }

  function paintPreview() {
    const total = list.length;
    if (!total) {
      current = 0;
      preview.removeAttribute('src');
      stage.classList.add('is-empty');
      placeholder.hidden = false;
      indexLabel.textContent = '0 / 0';
      range.max = '0';
      range.value = '0';
      hint.textContent = 'Rotasi 360° belum tersedia untuk produk ini.';
      prev.disabled = true;
      next.disabled = true;
      return;
    }

    current = Math.max(0, Math.min(current, total - 1));
    stage.classList.remove('is-empty');
    placeholder.hidden = true;
    preview.src = list[current];
    indexLabel.textContent = `${current + 1} / ${total}`;
    range.max = String(total - 1);
    range.value = String(current);
    hint.textContent =
      total >= 2
        ? 'Geser foto ke kiri atau kanan, atau gunakan slider untuk memutar sepatu.'
        : 'Tambahkan minimal dua foto untuk melihat putaran.';
    prev.disabled = total < 2;
    next.disabled = total < 2;
  }

  function paint() {
    paintGrid();
    paintPreview();
  }

  function emit() {
    paint();
    onChange?.([...list]);
  }

  function step(delta) {
    if (list.length < 2) return;
    current = (current + delta + list.length) % list.length;
    paintGrid();
    paintPreview();
  }

  async function addFiles(fileList, { replaceAt = null } = {}) {
    if (uploading) {
      toast('Tunggu unggahan sebelumnya selesai.', 'error');
      return;
    }
    const incoming = [...(fileList || [])];
    if (!incoming.length) return;

    if (replaceAt == null) {
      const remaining = MAX_FRAMES - list.length;
      if (remaining <= 0) {
        toast(`Maksimal ${MAX_FRAMES} foto per produk. Hapus beberapa foto dahulu.`, 'error');
        return;
      }
      if (incoming.length > remaining) {
        toast(`Hanya ${remaining} foto ditambahkan agar tidak melebihi ${MAX_FRAMES}.`, 'error');
        incoming.splice(remaining);
      }
    } else {
      incoming.splice(1);
    }

    uploading = true;
    setProgress(0);
    const target = incoming.length;
    let done = 0;

    try {
      for (const [position, file] of incoming.entries()) {
        setStatus(`Mengoptimalkan ${position + 1}/${target}…`);
        try {
          const prepared = await prepareImage(file);
          const [url] = await api.upload([prepared], {
            productId,
            onProgress: (ratio) => {
              setProgress((done + ratio) / target);
              setStatus(`Mengunggah ${position + 1}/${target} · ${Math.round(ratio * 100)}%`);
            },
          });
          if (!url) throw new Error('Server tidak mengembalikan URL gambar.');
          if (replaceAt != null) list[replaceAt] = url;
          else list.push(url);
          done += 1;
          if (replaceAt == null) current = list.length - 1;
          else current = replaceAt;
          setProgress(done / target);
        } catch (error) {
          toast(`${file.name}: ${error.message}`, 'error');
        }
      }
    } finally {
      uploading = false;
      setProgress(0);
      emit();
      if (!done) {
        toast('Tidak ada foto yang berhasil diunggah.', 'error');
      } else if (replaceAt != null) {
        toast('Foto berhasil diganti.');
      } else {
        toast(`${done} foto ditambahkan.`);
      }
    }
  }

  /* --------------------------------- upload -------------------------------- */

  const openPicker = () => input.click();
  drop.addEventListener('click', openPicker);
  drop.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openPicker();
    }
  });
  drop.addEventListener('dragover', (event) => {
    event.preventDefault();
    drop.classList.add('is-over');
  });
  drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
  drop.addEventListener('drop', (event) => {
    event.preventDefault();
    drop.classList.remove('is-over');
    addFiles(event.dataTransfer?.files);
  });

  input.addEventListener('change', () => {
    addFiles(input.files);
    input.value = '';
  });

  replaceInput.addEventListener('change', () => {
    if (replaceIndex >= 0 && replaceInput.files?.length) {
      addFiles(replaceInput.files, { replaceAt: replaceIndex });
    }
    replaceIndex = -1;
    replaceInput.value = '';
  });

  /* -------------------------------- grid aksi ------------------------------- */

  grid.addEventListener('click', async (event) => {
    const move = event.target.closest('[data-move]');
    const remove = event.target.closest('[data-remove]');
    const replace = event.target.closest('[data-replace]');

    if (move && !uploading) {
      const from = Number(move.closest('[data-index]').dataset.index);
      const to = from + Number(move.dataset.move);
      if (to < 0 || to >= list.length) return;
      [list[from], list[to]] = [list[to], list[from]];
      current = to;
      emit();
      return;
    }

    if (remove && !uploading) {
      const at = Number(remove.dataset.remove);
      const confirmed = await confirmDialog({
        title: 'Hapus foto 360°?',
        message: `Foto ${String(at + 1).padStart(2, '0')} akan dihapus dari urutan rotasi produk ini.`,
        confirmLabel: 'HAPUS FOTO',
      });
      if (!confirmed) return;
      list.splice(at, 1);
      if (current >= list.length) current = Math.max(0, list.length - 1);
      emit();
      toast('Foto dihapus dari urutan.');
      return;
    }

    if (replace && !uploading) {
      replaceIndex = Number(replace.dataset.replace);
      replaceInput.click();
    }
  });

  /* ------------------------------ drag urutan ------------------------------ */

  grid.addEventListener('dragstart', (event) => {
    const tile = event.target.closest('[data-index]');
    if (!tile || uploading) {
      event.preventDefault();
      return;
    }
    dragIndex = Number(tile.dataset.index);
    tile.classList.add('is-dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(dragIndex));
  });

  grid.addEventListener('dragover', (event) => {
    const tile = event.target.closest('[data-index]');
    if (!tile || dragIndex == null) return;
    event.preventDefault();
    grid.querySelectorAll('.frame-tile.is-over').forEach((node) => node.classList.remove('is-over'));
    if (Number(tile.dataset.index) !== dragIndex) tile.classList.add('is-over');
  });

  grid.addEventListener('drop', (event) => {
    const tile = event.target.closest('[data-index]');
    if (!tile || dragIndex == null) return;
    event.preventDefault();
    const to = Number(tile.dataset.index);
    if (to !== dragIndex) {
      const [moved] = list.splice(dragIndex, 1);
      list.splice(to, 0, moved);
      current = to;
      emit();
      toast('Urutan foto diperbarui.');
    }
    dragIndex = null;
  });

  grid.addEventListener('dragend', () => {
    dragIndex = null;
    grid.querySelectorAll('.is-dragging, .is-over').forEach((node) => {
      node.classList.remove('is-dragging', 'is-over');
    });
  });

  /* -------------------------------- preview -------------------------------- */

  let dragStart = null;
  stage.addEventListener('pointerdown', (event) => {
    if (!list.length) return;
    dragStart = event.clientX;
    stage.setPointerCapture?.(event.pointerId);
  });
  stage.addEventListener('pointermove', (event) => {
    if (dragStart == null) return;
    const dx = event.clientX - dragStart;
    if (Math.abs(dx) < 24) return;
    step(dx > 0 ? 1 : -1);
    dragStart = event.clientX;
  });
  const endDrag = (event) => {
    dragStart = null;
    stage.releasePointerCapture?.(event.pointerId);
  };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);

  range.addEventListener('input', () => {
    current = Number(range.value) || 0;
    paintGrid();
    paintPreview();
  });
  prev.addEventListener('click', () => step(-1));
  next.addEventListener('click', () => step(1));

  paint();

  return {
    getFrames: () => [...list],
    isUploading: () => uploading,
  };
}
