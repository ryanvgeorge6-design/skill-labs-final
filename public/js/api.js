// Centralize JSON requests and attach the stored JWT consistently.
const Api = (() => {
  const BASE_URL = '/api';
  const TOKEN_KEY = 'reelhouse_token';

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('reelhouse_user');
  }

  async function request(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (getToken()) headers.set('Authorization', `Bearer ${getToken()}`);
    if (options.body !== undefined) headers.set('Content-Type', 'application/json');

    const response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await response.json() : await response.text();

    if (!response.ok) {
      const error = new Error(
        (data && typeof data === 'object' && (data.message || data.error)) ||
        (typeof data === 'string' && data) ||
        `Request failed (${response.status})`
      );
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  }

  return {
    request,
    get: path => request(path),
    post: (path, body) => request(path, { method: 'POST', body }),
    put: (path, body) => request(path, { method: 'PUT', body }),
    delete: path => request(path, { method: 'DELETE' }),
    getToken,
    setToken,
    clearToken
  };
})();
