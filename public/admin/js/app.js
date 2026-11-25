import { api } from '/js/api.js';
import { toast } from '/js/util.js';
import { closeModal, handleAuthError } from './ui.js';
import * as dashboard from './views/dashboard.js';
import * as products from './views/products.js';
import * as categories from './views/categories.js';
import * as inventory from './views/inventory.js';
import * as orders from './views/orders.js';
import * as settings from './views/settings.js';

const sections = {
  dashboard: { label: 'Dashboard', kicker: 'Overview', render: dashboard.render },
  products: { label: 'Products', kicker: 'Catalog', render: products.render },
  categories: { label: 'Categories', kicker: 'Catalog', render: categories.render },
  inventory: { label: 'Inventory', kicker: 'Stock control', render: inventory.render },
  orders: { label: 'Orders', kicker: 'Operations', render: orders.render },
  settings: { label: 'Store Settings', kicker: 'Configuration', render: settings.render },
};

const view = () => document.getElementById('adminView');
const sidebar = document.getElementById('sidebar');
const sidebarScrim = document.getElementById('sidebarScrim');
const titleNode = document.getElementById('pageTitle');
const kickerNode = document.getElementById('pageKicker');

let activeSection = 'dashboard';
let navigating = false;

function closeSidebar() {
  sidebar?.classList.remove('is-open');
  sidebarScrim?.classList.remove('is-open');
}

async function refreshBadge() {
  try {
    const { orders: pending } = await api.admin.orders('pending');
    const badge = document.getElementById('orderBadge');
    if (badge) badge.textContent = pending.length ? String(pending.length) : '';
  } catch {
    /* badge bukan hal kritikal */
  }
}

async function navigate(section, { replace = false } = {}) {
  const key = sections[section] ? section : 'dashboard';
  if (navigating) return;
  navigating = true;
  activeSection = key;

  document.querySelectorAll('[data-section]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.section === key);
  });
  if (titleNode) titleNode.textContent = sections[key].label;
  if (kickerNode) kickerNode.textContent = sections[key].kicker;
  if (replace) history.replaceState(null, '', `#${key}`);
  else if (window.location.hash !== `#${key}`) history.replaceState(null, '', `#${key}`);
  closeSidebar();

  const container = view();
  container.innerHTML = `
    <div class="skeleton-block" style="height:64px"></div>
    <div class="skeleton-block"></div>
    <div class="skeleton-block"></div>`;

  try {
    await sections[key].render(container);
    if (key === 'orders') refreshBadge();
  } catch (error) {
    console.error(error);
    if (!handleAuthError(error)) {
      container.innerHTML = `<div class="panel"><div class="empty-note">
        <i class="fa-solid fa-triangle-exclamation"></i>
        ${error.message || 'Data gagal dimuat.'}
        <div style="margin-top:14px"><button class="abtn abtn--ghost" id="retryView">MUAT ULANG</button></div>
      </div></div>`;
      container.querySelector('#retryView')?.addEventListener('click', () => navigate(key, { replace: true }));
    }
  } finally {
    navigating = false;
  }
}

function initNavigation() {
  document.querySelectorAll('[data-section]').forEach((button) => {
    button.addEventListener('click', () => navigate(button.dataset.section, { replace: true }));
  });

  window.addEventListener('hashchange', () => {
    const key = window.location.hash.replace('#', '') || 'dashboard';
    if (key !== activeSection) navigate(key, { replace: true });
  });

  document.addEventListener('admin:navigate', (event) => {
    navigate(event.detail || 'dashboard', { replace: true });
  });

  document.addEventListener('admin:refresh-badge', refreshBadge);

  document.getElementById('sidebarToggle')?.addEventListener('click', () => {
    sidebar?.classList.add('is-open');
    sidebarScrim?.classList.add('is-open');
  });
  sidebarScrim?.addEventListener('click', closeSidebar);

  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    try {
      await api.logout();
    } catch {
      /* tetap arahkan ke halaman login */
    }
    window.location.replace('/admin/login');
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeModal();
  });
}

async function boot() {
  try {
    const { admin } = await api.me();
    const nameNode = document.getElementById('adminName');
    if (nameNode) nameNode.textContent = admin?.username || 'admin';
  } catch {
    window.location.replace('/admin/login');
    return;
  }

  initNavigation();
  refreshBadge();
  const initial = window.location.hash.replace('#', '') || 'dashboard';
  await navigate(initial, { replace: true });
}

boot();
