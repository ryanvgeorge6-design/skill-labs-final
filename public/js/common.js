// Shared DOM helpers, response normalization, navigation, and client-side guards.
const Cinema = (() => {
  const byId = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const unwrap = response => {
    let data = response;
    while (data && !Array.isArray(data) && data.data && typeof data.data === 'object') data = data.data;
    return data;
  };
  const oneOf = (value, ...keys) => {
    for (const key of keys) if (value && value[key] !== undefined && value[key] !== null) return value[key];
    return undefined;
  };
  const listOf = response => {
    const data = unwrap(response);
    return Array.isArray(data) ? data : (data && (data.items || data.results || data.movies || data.shows || data.bookings || data.seats) || []);
  };
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text ?? '');
    return node;
  };
  const showMessage = (target, message, success = false) => {
    target.textContent = message || '';
    target.classList.toggle('success', Boolean(success));
  };
  const money = value => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'INR' }).format(Number(value) || 0);
  const dateTime = value => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value || 'Time TBA') : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  };
  const id = item => oneOf(item, 'id', '_id', 'movieId', 'showId', 'bookingId');
  const titleOf = item => oneOf(item, 'title', 'name') || 'Untitled';

  async function guard(role) {
    if (!Api.getToken()) {
      location.href = '/login.html';
      return false;
    }
    try {
      const result = unwrap(await Api.get('/auth/me'));
      const user = result.user || result;
      localStorage.setItem('reelhouse_user', JSON.stringify(user));
      if (role && user.role !== role) {
        location.href = user.role === 'organiser' ? '/dashboard.html' : '/movies.html';
        return false;
      }
      return true;
    } catch (error) {
      if (error.status === 401) {
        Api.clearToken();
        location.href = '/login.html';
        return false;
      }
      throw error;
    }
  }

  function mountNavbar() {
    const root = byId('navbar');
    if (!root) return;
    const nav = element('nav', 'navbar');
    nav.setAttribute('aria-label', 'Main navigation');
    const brand = element('a', 'brand');
    brand.href = '/';
    const mark = element('span', 'brand-mark', 'R');
    brand.append(mark, document.createTextNode('Reelhouse'));
    const links = element('div', 'nav-links');
    let user;
    try { user = JSON.parse(localStorage.getItem('reelhouse_user') || 'null'); } catch { user = null; }

    const addLink = (label, href) => {
      const link = element('a', '', label);
      link.href = href;
      links.append(link);
    };
    if (user && Api.getToken()) {
      if (user.role === 'organiser') addLink('Dashboard', '/dashboard.html');
      else {
        addLink('Movies', '/movies.html');
        addLink('My bookings', '/bookings.html');
      }
      const logout = element('button', 'nav-action', 'Sign out');
      logout.type = 'button';
      logout.addEventListener('click', () => {
        Api.clearToken();
        location.href = '/login.html';
      });
      links.append(logout);
    } else {
      addLink('Movies', '/movies.html');
      addLink('Sign in', '/login.html');
      addLink('Register', '/register.html');
    }
    nav.append(brand, links);
    root.append(nav);
  }

  document.addEventListener('DOMContentLoaded', mountNavbar);
  return { byId, params, unwrap, oneOf, listOf, element, showMessage, money, dateTime, id, titleOf, guard };
})();
