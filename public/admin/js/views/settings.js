import { api } from '/js/api.js';
import { escapeHtml, toast } from '/js/util.js';
import { setBusy } from '../ui.js';

export async function render(root) {
  const { settings } = await api.admin.settings();

  root.innerHTML = `
    <div class="view-head">
      <div>
        <h2>Store settings</h2>
        <p>Identitas toko, kontak, dan konten homepage. Perubahan langsung tampil di website pelanggan.</p>
      </div>
    </div>

    <form id="settingsForm" class="settings-split" novalidate>
      <div class="panel settings-section">
        <h3>Identity</h3>
        <div class="aform">
          <div class="afield">
            <label for="sStoreName">Nama toko</label>
            <input class="input" id="sStoreName" name="storeName" maxlength="80" value="${escapeHtml(settings.storeName)}">
          </div>
          <div class="afield">
            <label for="sLogoText">Logo (teks)</label>
            <input class="input" id="sLogoText" name="logoText" maxlength="40" value="${escapeHtml(settings.logoText)}">
          </div>
          <div class="afield span-2">
            <label for="sTagline">Tagline</label>
            <input class="input" id="sTagline" name="tagline" maxlength="160" value="${escapeHtml(settings.tagline)}">
          </div>
          <div class="afield span-2">
            <label>Logo (gambar)</label>
            <div class="upload-field">
              <input class="input" id="sLogoImage" name="logoImage" placeholder="/uploads/logo.png" value="${escapeHtml(settings.logoImage || '')}">
              <input type="file" id="logoFile" accept="image/png,image/jpeg,image/webp,image/avif" hidden>
              <button class="abtn abtn--ghost" type="button" id="uploadLogo"><i class="fa-solid fa-upload"></i> UPLOAD</button>
            </div>
            <img class="preview-wide" id="logoPreview" src="${escapeHtml(settings.logoImage || '/assets/placeholder.svg')}" alt="Pratinjau logo" style="height:70px;object-fit:contain;background:#f4ece1">
          </div>
        </div>
      </div>

      <div class="panel settings-section">
        <h3>Contact</h3>
        <div class="aform">
          <div class="afield">
            <label for="sWhatsapp">Nomor WhatsApp <span>format 62…</span></label>
            <input class="input" id="sWhatsapp" name="whatsapp" maxlength="20" value="${escapeHtml(settings.whatsapp)}" placeholder="6282122190680">
          </div>
          <div class="afield">
            <label for="sWhatsappDisplay">Nomor WhatsApp (tampilan)</label>
            <input class="input" id="sWhatsappDisplay" name="whatsappDisplay" maxlength="30" value="${escapeHtml(settings.whatsappDisplay)}" placeholder="0821 2219 0680">
          </div>
          <div class="afield">
            <label for="sEmail">Email</label>
            <input class="input" id="sEmail" name="email" type="email" maxlength="120" value="${escapeHtml(settings.email)}">
          </div>
          <div class="afield">
            <label for="sInstagram">Instagram</label>
            <input class="input" id="sInstagram" name="instagram" maxlength="60" placeholder="@sneakerspace" value="${escapeHtml(settings.instagram)}">
          </div>
          <div class="afield">
            <label for="sAddress">Alamat</label>
            <input class="input" id="sAddress" name="address" maxlength="200" value="${escapeHtml(settings.address)}">
          </div>
          <div class="afield">
            <label for="sHours">Jam operasional</label>
            <input class="input" id="sHours" name="hours" maxlength="120" value="${escapeHtml(settings.hours)}">
          </div>
        </div>
      </div>

      <div class="panel settings-section">
        <h3>Homepage</h3>
        <div class="aform">
          <div class="afield span-2">
            <label for="sAnnouncement">Announcement bar <span>pisahkan dengan ·</span></label>
            <input class="input" id="sAnnouncement" name="announcement" maxlength="300" value="${escapeHtml(settings.announcement)}">
          </div>
          <div class="afield">
            <label for="sHeroEyebrow">Hero eyebrow</label>
            <input class="input" id="sHeroEyebrow" name="heroEyebrow" maxlength="120" value="${escapeHtml(settings.heroEyebrow)}">
          </div>
          <div class="afield">
            <label for="sHeroTitle">Hero headline</label>
            <input class="input" id="sHeroTitle" name="heroTitle" maxlength="120" value="${escapeHtml(settings.heroTitle)}">
          </div>
          <div class="afield span-2">
            <label for="sHeroSubtitle">Hero subtitle</label>
            <textarea class="textarea" id="sHeroSubtitle" name="heroSubtitle" maxlength="400">${escapeHtml(settings.heroSubtitle)}</textarea>
          </div>

          <div class="afield span-2">
            <label>Hero image</label>
            <div class="upload-field">
              <input class="input" id="sHeroImage" name="heroImage" value="${escapeHtml(settings.heroImage || '')}" placeholder="/uploads/hero.jpg">
              <input type="file" id="heroFile" accept="image/*" hidden>
              <button class="abtn abtn--ghost" type="button" id="uploadHero"><i class="fa-solid fa-upload"></i> UPLOAD</button>
            </div>
            <img class="preview-wide" id="heroPreview" src="${escapeHtml(settings.heroImage || '/assets/placeholder.svg')}" alt="Pratinjau hero">
          </div>

          <div class="afield span-2">
            <label>Banner homepage</label>
            <div class="upload-field">
              <input class="input" id="sBannerImage" name="bannerImage" value="${escapeHtml(settings.bannerImage || '')}" placeholder="/uploads/banner.jpg">
              <input type="file" id="bannerFile" accept="image/*" hidden>
              <button class="abtn abtn--ghost" type="button" id="uploadBanner"><i class="fa-solid fa-upload"></i> UPLOAD</button>
            </div>
            <img class="preview-wide" id="bannerPreview" src="${escapeHtml(settings.bannerImage || '/assets/placeholder.svg')}" alt="Pratinjau banner">
          </div>

          <div class="afield">
            <label for="sAboutTitle">About title</label>
            <input class="input" id="sAboutTitle" name="aboutTitle" maxlength="120" value="${escapeHtml(settings.aboutTitle)}">
          </div>
          <div class="afield">
            <label for="sAboutText">About text</label>
            <textarea class="textarea" id="sAboutText" name="aboutText" maxlength="1200">${escapeHtml(settings.aboutText)}</textarea>
          </div>
        </div>
      </div>

      <p class="form-error" id="settingsError"></p>
      <div class="settings-actions">
        <button class="abtn abtn--ghost" type="reset">RESET</button>
        <button class="abtn abtn--primary" type="submit"><i class="fa-solid fa-check"></i> SIMPAN PENGATURAN</button>
      </div>
    </form>`;

  const form = root.querySelector('#settingsForm');
  const errorNode = root.querySelector('#settingsError');

  bindUpload(root, '#uploadLogo', '#logoFile', '#sLogoImage', '#logoPreview');
  bindUpload(root, '#uploadHero', '#heroFile', '#sHeroImage', '#heroPreview');
  bindUpload(root, '#uploadBanner', '#bannerFile', '#sBannerImage', '#bannerPreview');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorNode.textContent = '';
    const payload = {};
    ['storeName', 'logoText', 'tagline', 'logoImage', 'whatsapp', 'whatsappDisplay', 'email', 'instagram', 'address', 'hours', 'announcement', 'heroEyebrow', 'heroTitle', 'heroSubtitle', 'heroImage', 'bannerImage', 'aboutTitle', 'aboutText'].forEach(
      (key) => {
        payload[key] = form.querySelector(`[name="${key}"]`)?.value ?? '';
      }
    );

    if (!payload.storeName.trim()) {
      errorNode.textContent = 'Nama toko wajib diisi.';
      return;
    }

    const submit = form.querySelector('[type="submit"]');
    setBusy(submit, true, 'MENYIMPAN…');
    try {
      await api.admin.saveSettings(payload);
      toast('Pengaturan toko berhasil disimpan.');
      await render(root);
    } catch (error) {
      errorNode.textContent = error.message;
      setBusy(submit, false);
    }
  });

  form.addEventListener('reset', (event) => {
    event.preventDefault();
    render(root);
  });
}

function bindUpload(root, buttonSelector, fileSelector, inputSelector, previewSelector) {
  const button = root.querySelector(buttonSelector);
  const file = root.querySelector(fileSelector);
  const input = root.querySelector(inputSelector);
  const preview = root.querySelector(previewSelector);
  if (!button || !file || !input || !preview) return;

  button.addEventListener('click', () => file.click());
  file.addEventListener('change', async () => {
    const selected = file.files?.[0];
    if (!selected) return;
    setBusy(button, true, 'MENGUNGGAH…');
    try {
      const [url] = await api.upload([selected]);
      input.value = url;
      preview.src = url;
      toast('Gambar berhasil diunggah. Klik simpan untuk menerapkan.');
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setBusy(button, false);
      file.value = '';
    }
  });

  input.addEventListener('change', () => {
    preview.src = input.value.trim() || '/assets/placeholder.svg';
  });
}
