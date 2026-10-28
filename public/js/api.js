const BASE_URL = '/api';

const fallbackMovies = [
  { id: 1, title: 'Dune: Part Two', genre: 'Sci‑Fi', rating: 8.7, price: 220, icon: 'D' },
  { id: 2, title: 'Oppenheimer', genre: 'Drama', rating: 9.2, price: 260, icon: 'O' },
  { id: 3, title: 'Spider‑Man: Across the Spider-Verse', genre: 'Animation', rating: 8.8, price: 240, icon: 'S' },
  { id: 4, title: 'The Batman', genre: 'Action', rating: 8.5, price: 210, icon: 'B' }
];

const fallbackShows = [
  { id: 1, movie: 'Dune: Part Two', time: '12:30 PM', hall: 'Hall A', seatsLeft: 18 },
  { id: 2, movie: 'Oppenheimer', time: '3:45 PM', hall: 'Hall B', seatsLeft: 10 },
  { id: 3, movie: 'Spider‑Man: Across the Spider-Verse', time: '7:00 PM', hall: 'Hall C', seatsLeft: 24 }
];

const fallbackDashboard = {
  stats: {
    totalShows: 12,
    totalBookings: 86,
    occupancy: '72%'
  }
};

const movieGrid = document.getElementById('moviesGrid');
const movieSelect = document.getElementById('movieSelect');
const showSelect = document.getElementById('showSelect');
const seatCountInput = document.getElementById('seatCount');
const ticketPriceEl = document.getElementById('ticketPrice');
const totalPriceEl = document.getElementById('totalPrice');
const summarySeatsEl = document.getElementById('summarySeats');
const bookingForm = document.getElementById('bookingForm');
const bookingStatusEl = document.getElementById('bookingStatus');
const showsList = document.getElementById('showsList');
const dashboardGrid = document.getElementById('dashboardGrid');
const movieCountEl = document.getElementById('movieCount');
const showCountEl = document.getElementById('showCount');
const bookingCountEl = document.getElementById('bookingCount');
const occupancyEl = document.getElementById('occupancy');

let selectedMovie = null;
let allMovies = [...fallbackMovies];
let allShows = [...fallbackShows];

async function fetchJson(url, fallback) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Request failed');
    return await response.json();
  } catch (error) {
    return fallback;
  }
}

function formatCurrency(value) {
  return `₹${Number(value).toLocaleString('en-IN')}`;
}

function renderMovies(movies) {
  if (!movieGrid) return;

  movieGrid.innerHTML = '';

  movies.forEach((movie) => {
    const card = document.createElement('div');
    card.className = 'movie-card' + (selectedMovie && selectedMovie.id === movie.id ? ' selected' : '');

    card.innerHTML = `
      <div class="movie-poster"><span>${movie.icon || 'M'}</span></div>
      <h3>${movie.title}</h3>
      <div class="meta">
        <span>${movie.genre}</span>
        <span>${movie.rating}</span>
      </div>
      <div class="meta">
        <span>From</span>
        <span class="price">${formatCurrency(movie.price)}</span>
      </div>
    `;

    card.addEventListener('click', () => {
      selectedMovie = movie;
      if (movieSelect) movieSelect.value = String(movie.id);
      renderMovies(movies);
      updateBookingSummary();
    });

    movieGrid.appendChild(card);
  });
}

function renderMovieOptions(movies) {
  if (!movieSelect) return;

  movieSelect.innerHTML = movies
    .map((movie) => `<option value="${movie.id}">${movie.title}</option>`)
    .join('');

  if (!selectedMovie) selectedMovie = movies[0];
  movieSelect.value = String(selectedMovie.id);
}

function renderShowOptions(shows) {
  if (!showSelect) return;

  showSelect.innerHTML = shows
    .map((show) => `<option value="${show.id}">${show.movie} — ${show.time} (${show.hall})</option>`)
    .join('');
}

function renderShows(shows) {
  if (!showsList) return;

  showsList.innerHTML = shows
    .map(
      (show) => `
        <div class="show-item">
          <div>
            <strong>${show.movie}</strong>
            <span>${show.time} • ${show.hall}</span>
          </div>
          <span class="tag">${show.seatsLeft} seats left</span>
        </div>
      `
    )
    .join('');
}

function renderDashboard(data) {
  if (!dashboardGrid) return;

  const stats = data?.stats || fallbackDashboard.stats;

  dashboardGrid.innerHTML = `
    <div class="dash-card">
      <span class="label">Total shows</span>
      <span class="value">${stats.totalShows}</span>
    </div>
    <div class="dash-card">
      <span class="label">Bookings</span>
      <span class="value">${stats.totalBookings}</span>
    </div>
    <div class="dash-card">
      <span class="label">Occupancy</span>
      <span class="value">${stats.occupancy}</span>
    </div>
  `;

  if (movieCountEl) movieCountEl.textContent = String(allMovies.length);
  if (showCountEl) showCountEl.textContent = String(allShows.length);
  if (bookingCountEl) bookingCountEl.textContent = String(stats.totalBookings);
  if (occupancyEl) occupancyEl.textContent = stats.occupancy;
}

function updateBookingSummary() {
  if (!movieSelect || !seatCountInput || !ticketPriceEl || !summarySeatsEl || !totalPriceEl) return;

  const movie = allMovies.find((item) => String(item.id) === movieSelect.value) || allMovies[0];
  const seats = Number(seatCountInput.value) || 1;
  const total = movie.price * seats;

  ticketPriceEl.textContent = formatCurrency(movie.price);
  summarySeatsEl.textContent = String(seats);
  totalPriceEl.textContent = formatCurrency(total);
}

movieSelect?.addEventListener('change', updateBookingSummary);
seatCountInput?.addEventListener('input', updateBookingSummary);

document.getElementById('jumpToMovies')?.addEventListener('click', () => {
  document.getElementById('movies')?.scrollIntoView({ behavior: 'smooth' });
  if (bookingStatusEl) {
    bookingStatusEl.textContent = 'Browse the latest blockbuster picks.';
    bookingStatusEl.style.color = '#d5b884';
  }
});

document.getElementById('jumpToShows')?.addEventListener('click', () => {
  document.getElementById('shows')?.scrollIntoView({ behavior: 'smooth' });
  if (bookingStatusEl) {
    bookingStatusEl.textContent = 'Check out today’s show timings.';
    bookingStatusEl.style.color = '#d5b884';
  }
});

const authModal = document.getElementById('authModal');
const authStatusEl = document.getElementById('authStatus');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const authTabs = document.querySelectorAll('.auth-tab');
const authForms = document.querySelectorAll('.auth-form');

const openAuthModal = () => {
  authModal?.classList.add('open');
};

const closeAuthModal = () => {
  authModal?.classList.remove('open');
  if (authStatusEl) authStatusEl.textContent = '';
};

document.getElementById('loginBtn')?.addEventListener('click', () => {
  openAuthModal();
  if (authStatusEl) {
    authStatusEl.textContent = 'Welcome back! Sign in to continue.';
    authStatusEl.style.color = '#d5b884';
  }
});

document.getElementById('closeAuthModal')?.addEventListener('click', closeAuthModal);
authModal?.addEventListener('click', (event) => {
  if (event.target === authModal) closeAuthModal();
});

authTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    const mode = tab.dataset.mode;
    authTabs.forEach((item) => item.classList.toggle('active', item === tab));
    authForms.forEach((form) => form.classList.toggle('active', form.id === (mode === 'login' ? 'loginForm' : 'signupForm')));
  });
});

loginForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value.trim();

  try {
    const response = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Login failed');

    if (authStatusEl) {
      authStatusEl.textContent = `Welcome back, ${result.user.name}!`;
      authStatusEl.style.color = '#9eaf97';
    }
    const loginButton = document.getElementById('loginBtn');
    if (loginButton) loginButton.textContent = result.user.name.split(' ')[0];
    closeAuthModal();
  } catch (error) {
    if (authStatusEl) {
      authStatusEl.textContent = error.message;
      authStatusEl.style.color = '#c78d80';
    }
  }
});

signupForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const name = document.getElementById('signupName').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value.trim();

  try {
    const response = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Signup failed');

    if (authStatusEl) {
      authStatusEl.textContent = `Account created for ${result.user.name}. You can now log in.`;
      authStatusEl.style.color = '#9eaf97';
    }
    document.querySelector('[data-mode="login"]').click();
  } catch (error) {
    if (authStatusEl) {
      authStatusEl.textContent = error.message;
      authStatusEl.style.color = '#c78d80';
    }
  }
});

document.querySelectorAll('[data-scroll]').forEach((button) => {
  button.addEventListener('click', (event) => {
    const id = event.currentTarget.getAttribute('data-scroll');
    const target = id === 'top' ? document.body : document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

bookingForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const movie = allMovies.find((item) => String(item.id) === movieSelect.value) || allMovies[0];
  const seats = Number(seatCountInput.value) || 1;
  const total = movie.price * seats;

  try {
    const response = await fetch(`${BASE_URL}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ movie: movie.title, seats, total })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Booking failed');
    }

    if (bookingStatusEl) {
      bookingStatusEl.textContent = `Booked successfully: ${movie.title} for ${seats} seat(s).`;
      bookingStatusEl.style.color = '#9eaf97';
    }
  } catch (error) {
    if (bookingStatusEl) {
      bookingStatusEl.textContent = 'Demo booking saved locally: ' + error.message;
      bookingStatusEl.style.color = '#d5b884';
    }
  }
});

async function loadApp() {
  const moviesResponse = await fetchJson(`${BASE_URL}/movies`, { movies: fallbackMovies });
  const showsResponse = await fetchJson(`${BASE_URL}/shows`, { shows: fallbackShows });
  const dashboardResponse = await fetchJson(`${BASE_URL}/organiser/dashboard`, fallbackDashboard);

  allMovies = Array.isArray(moviesResponse?.movies) ? moviesResponse.movies : fallbackMovies;
  allShows = Array.isArray(showsResponse?.shows) ? showsResponse.shows : fallbackShows;

  if (!selectedMovie) selectedMovie = allMovies[0];

  renderMovies(allMovies);
  renderMovieOptions(allMovies);
  renderShows(allShows);
  renderShowOptions(allShows);
  renderDashboard(dashboardResponse);
  updateBookingSummary();
}

loadApp();
