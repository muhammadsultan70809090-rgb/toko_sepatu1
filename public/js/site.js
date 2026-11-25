import { initBag } from './bag.js';
import { escapeHtml, initImageFallback, initNav, initReveal } from './util.js';

const waLink = (number, text = '') =>
  `https://wa.me/${String(number || '6282122190680').replace(/\D/g, '')}${
    text ? `?text=${encodeURIComponent(text)}` : ''
  }`;

export function initShell(settings = {}) {
  initNav();
  initImageFallback();

  const logo = document.getElementById('logoText');
  const logoLink = document.querySelector('.nav .logo');
  if (logoLink && settings.logoImage) {
    logoLink.innerHTML = `<img src="${escapeHtml(settings.logoImage)}" alt="${
      escapeHtml(settings.storeName) || 'SneakerSpace'
    }">`;
  } else if (logo && settings.logoText) {
    logo.textContent = settings.logoText;
  }

  document.getElementById('searchToggle')?.addEventListener('click', () => {
    const input = document.getElementById('searchInput');
    if (input) {
      document.getElementById('collection')?.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => input.focus({ preventScroll: true }), 480);
    } else {
      window.location.href = '/#collection';
    }
  });

  const ticker = document.getElementById('ticker');
  if (ticker && settings.announcement) {
    const parts = settings.announcement
      .split('·')
      .map((part) => part.trim())
      .filter(Boolean);
    const block = parts.map((part) => `<span>${escapeHtml(part)}</span>`).join('');
    ticker.innerHTML = block + block;
  }

  const marquee = document.getElementById('marquee');
  if (marquee) {
    const phrases = [
      settings.tagline || 'Discover your style. Define your steps.',
      'Authenticity guaranteed',
      'New drop every Friday',
      'Curated in Jakarta',
    ];
    const block = phrases.map((phrase) => `<span>${escapeHtml(phrase)}</span>`).join('');
    marquee.innerHTML = block + block;
  }

  const setText = (id, value) => {
    const node = document.getElementById(id);
    if (node && value) node.textContent = value;
  };

  setText('footerTagline', settings.tagline);
  setText('footerAddress', settings.address);
  setText('footerHours', settings.hours);
  setText('footerPhone', settings.whatsappDisplay ? `WhatsApp: ${settings.whatsappDisplay}` : '');
  setText('footerEmail', settings.email);

  const wa = waLink(settings.whatsapp, 'Halo SneakerSpace! Saya ingin bertanya tentang koleksi sneaker.');
  ['footerWa', 'footerWa2'].forEach((id) => {
    const node = document.getElementById(id);
    if (node) {
      node.href = wa;
      node.target = '_blank';
      node.rel = 'noopener';
    }
  });

  const ig = document.getElementById('footerIg');
  if (ig) {
    const handle = String(settings.instagram || '').replace(/^@/, '').trim();
    if (handle) {
      ig.href = `https://instagram.com/${handle}`;
      ig.target = '_blank';
      ig.rel = 'noopener';
    } else {
      ig.remove();
    }
  }

  const mail = document.getElementById('footerMail');
  if (mail && settings.email) {
    mail.href = `mailto:${settings.email}`;
  } else if (mail) {
    mail.remove();
  }

  initBag({
    whatsapp: settings.whatsapp,
    whatsappDisplay: settings.whatsappDisplay,
    storeName: settings.storeName,
  });

  initReveal();
}
