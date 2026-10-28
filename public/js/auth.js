// Validate credentials in the browser, then keep the API as the auth source of truth.
document.addEventListener('DOMContentLoaded', () => {
  const form = Cinema.byId('auth-form');
  const message = Cinema.byId('form-message');
  const isRegister = location.pathname.endsWith('register.html');
  const redirectFor = user => {
    location.href = user.role === 'organiser' ? '/dashboard.html' : '/movies.html';
  };
  let cachedUser;
  try { cachedUser = JSON.parse(localStorage.getItem('reelhouse_user') || 'null'); } catch { cachedUser = null; }
  if (Api.getToken() && cachedUser) {
    redirectFor(cachedUser);
    return;
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    message.textContent = '';
    if (!form.reportValidity()) return;
    const fields = new FormData(form);
    const payload = {
      email: String(fields.get('email')).trim(),
      password: String(fields.get('password'))
    };
    if (isRegister) {
      payload.name = String(fields.get('name')).trim();
      payload.role = String(fields.get('role'));
    }
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = isRegister ? 'Creating account…' : 'Signing in…';
    try {
      const result = Cinema.unwrap(await Api.post(isRegister ? '/auth/register' : '/auth/login', payload));
      const token = result.token || (result.data && result.data.token);
      const user = result.user || (result.data && result.data.user);
      if (!token || !user) throw new Error('The server response did not include a token and user.');
      Api.setToken(token);
      localStorage.setItem('reelhouse_user', JSON.stringify(user));
      redirectFor(user);
    } catch (error) {
      Cinema.showMessage(message, error.message);
    } finally {
      button.disabled = false;
      button.textContent = isRegister ? 'Create account' : 'Sign in';
    }
  });
});
