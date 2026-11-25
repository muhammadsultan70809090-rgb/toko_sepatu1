import { api } from '/js/api.js';

const form = document.getElementById('loginForm');
const errorNode = document.getElementById('loginError');
const button = document.getElementById('loginBtn');
const passwordInput = document.getElementById('password');
const toggle = document.getElementById('togglePassword');

// Sudah punya sesi aktif? Langsung masuk ke dashboard.
api
  .me()
  .then(() => window.location.replace('/admin'))
  .catch(() => {});

toggle?.addEventListener('click', () => {
  const isPassword = passwordInput.type === 'password';
  passwordInput.type = isPassword ? 'text' : 'password';
  toggle.innerHTML = `<i class="fa-regular ${isPassword ? 'fa-eye-slash' : 'fa-eye'}"></i>`;
  toggle.setAttribute('aria-label', isPassword ? 'Sembunyikan password' : 'Tampilkan password');
});

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const usernameInput = form.querySelector('#username');
  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  errorNode.textContent = '';
  if (!username) {
    errorNode.textContent = 'Username wajib diisi.';
    usernameInput.focus();
    return;
  }
  if (!password) {
    errorNode.textContent = 'Password wajib diisi.';
    passwordInput.focus();
    return;
  }

  button.disabled = true;
  const original = button.innerHTML;
  button.innerHTML = 'MEMVERIFIKASI…';

  try {
    await api.login(username, password);
    window.location.replace('/admin');
  } catch (error) {
    errorNode.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${error.message}`;
    button.disabled = false;
    button.innerHTML = original;
    passwordInput.select?.();
  }
});
