export const rupiah = (value) =>
  'Rp' + Math.round(Number(value) || 0).toLocaleString('id-ID');

export const escapeHtml = (value = '') =>
  String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));

export function stockMeta(stock) {
  const total = Number(stock) || 0;
  if (total <= 0) return { label: 'Sold out', cls: 'is-out' };
  if (total <= 5) return { label: `Only ${total} left`, cls: 'is-low' };
  return { label: 'In stock', cls: '' };
}

let toastStack = null;

export function toast(message, type = 'success') {
  if (!toastStack) toastStack = document.getElementById('toasts');
  if (!toastStack) return;
  const node = document.createElement('div');
  node.className = `toast${type === 'error' ? ' is-error' : ''}`;
  node.innerHTML = `<i class="fa-solid ${type === 'error' ? 'fa-circle-exclamation' : 'fa-check'}"></i><span>${escapeHtml(message)}</span>`;
  toastStack.appendChild(node);
  setTimeout(() => {
    node.classList.add('is-out');
    setTimeout(() => node.remove(), 380);
  }, 3600);
}

export function initImageFallback() {
  document.addEventListener(
    'error',
    (event) => {
      const img = event.target;
      if (img instanceof HTMLImageElement && !img.dataset.fallback) {
        img.dataset.fallback = '1';
        img.src = '/assets/placeholder.svg';
      }
    },
    true
  );
}

export function initReveal() {
  const nodes = document.querySelectorAll('[data-reveal]');
  if (!('IntersectionObserver' in window)) {
    nodes.forEach((node) => node.classList.add('is-in'));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
  );
  nodes.forEach((node) => observer.observe(node));
}

export function initNav() {
  const nav = document.getElementById('nav');
  const menu = document.getElementById('mobileMenu');
  const toggle = document.getElementById('navMenu');

  if (nav) {
    const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  if (menu && toggle) {
    const close = () => {
      menu.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    };
    toggle.addEventListener('click', () => {
      const isOpen = menu.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(isOpen));
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });
    menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', close));
    const closeBtn = menu.querySelector('[data-close-menu]');
    if (closeBtn) closeBtn.addEventListener('click', close);
  }
}
