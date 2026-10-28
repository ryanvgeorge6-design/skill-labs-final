// Render organiser aggregates and forms exclusively through safe DOM text properties.
document.addEventListener('DOMContentLoaded', async () => {
  try {
    if (!await Cinema.guard('organiser')) return;
  } catch (error) {
    Cinema.byId('page-message').textContent = error.message;
    return;
  }
  const message = Cinema.byId('page-message');
  const movieForm = Cinema.byId('movie-form');
  const showForm = Cinema.byId('show-form');
  const movieSelect = showForm.elements.movieId;
  const table = Cinema.byId('shows-table');
  const summaries = Cinema.byId('summary-cards');
  let movies = [];

  const asArray = value => Array.isArray(value) ? value : [];
  function renderSummary(data) {
    summaries.replaceChildren();
    const items = [
      ['Shows', Cinema.oneOf(data, 'totalShows', 'showsCount') ?? asArray(data.shows).length],
      ['Tickets booked', Cinema.oneOf(data, 'totalBooked', 'bookedSeats', 'ticketsBooked') ?? 0],
      ['Seats on hold', Cinema.oneOf(data, 'totalHeld', 'heldSeats') ?? 0],
      ['Revenue', Cinema.money(Cinema.oneOf(data, 'totalRevenue', 'revenue') ?? 0)]
    ];
    for (const [label, value] of items) {
      const card = Cinema.element('article', 'panel summary-card');
      card.append(Cinema.element('span', '', label), Cinema.element('strong', '', value));
      summaries.append(card);
    }
  }
  function populateMovieSelect() {
    movieSelect.replaceChildren(new Option('Choose a movie', ''));
    for (const movie of movies) movieSelect.add(new Option(Cinema.titleOf(movie), Cinema.id(movie)));
  }
  function renderShows(shows) {
    table.replaceChildren();
    if (!shows.length) {
      const row = document.createElement('tr');
      const cell = Cinema.element('td', '', 'No shows have been added yet.');
      cell.colSpan = 6;
      row.append(cell);
      table.append(row);
      return;
    }
    for (const show of shows) {
      const row = document.createElement('tr');
      const movieTitle = Cinema.oneOf(show, 'movieTitle', 'movieName') || (show.movie && Cinema.titleOf(show.movie)) || 'Show';
      const booked = Number(Cinema.oneOf(show, 'booked', 'bookedSeats', 'seatsBooked') || 0);
      const held = Number(Cinema.oneOf(show, 'held', 'heldSeats', 'seatsHeld') || 0);
      const available = Number(Cinema.oneOf(show, 'available', 'availableSeats', 'seatsAvailable') || 0);
      const capacity = Number(Cinema.oneOf(show, 'capacity', 'totalSeats') || booked + held + available);
      const cells = [
        `${movieTitle} · ${Cinema.dateTime(Cinema.oneOf(show, 'startsAt', 'startTime', 'datetime'))}`,
        String(booked),
        String(held),
        String(available),
        Cinema.money(Cinema.oneOf(show, 'revenue', 'totalRevenue') || 0)
      ];
      for (const content of cells) row.append(Cinema.element('td', '', content));
      const occupancy = Cinema.element('td');
      const percentage = capacity ? Math.min(100, Math.round(booked / capacity * 100)) : 0;
      occupancy.append(Cinema.element('span', '', `${percentage}% booked`));
      const track = Cinema.element('div', 'bar-track');
      const fill = Cinema.element('div', 'bar-fill');
      fill.style.width = `${percentage}%`;
      track.append(fill);
      occupancy.append(track);
      row.append(occupancy);
      table.append(row);
    }
  }
  async function refresh() {
    const result = Cinema.unwrap(await Api.get('/organiser/dashboard'));
    const data = Cinema.unwrap(result.dashboard || result);
    movies = Cinema.listOf(data.movies || await Api.get('/movies'));
    populateMovieSelect();
    renderSummary(data);
    renderShows(Cinema.listOf(data.shows));
  }
  function formPayload(form, fields) {
    const values = new FormData(form);
    const payload = {};
    for (const [key, type] of Object.entries(fields)) {
      const value = String(values.get(key) || '').trim();
      if (value !== '') payload[key] = type === 'number' ? Number(value) : value;
    }
    return payload;
  }

  message.textContent = 'Loading dashboard…';
  try { await refresh(); message.textContent = ''; } catch (error) { message.textContent = error.message || 'Could not load dashboard.'; }

  movieForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!movieForm.reportValidity()) return;
    const button = movieForm.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      await Api.post('/organiser/movies', formPayload(movieForm, { title: 'string', description: 'string', duration: 'number', posterUrl: 'string' }));
      movieForm.reset();
      await refresh();
      message.textContent = 'Movie added.';
      message.classList.add('success');
    } catch (error) {
      message.textContent = error.message || 'Could not add movie.';
      message.classList.remove('success');
    } finally { button.disabled = false; }
  });

  showForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!showForm.reportValidity()) return;
    const button = showForm.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const payload = formPayload(showForm, { movieId: 'string', startsAt: 'string', price: 'number', capacity: 'number' });
      payload.startsAt = new Date(payload.startsAt).toISOString();
      await Api.post('/organiser/shows', payload);
      showForm.reset();
      await refresh();
      message.textContent = 'Show added.';
      message.classList.add('success');
    } catch (error) {
      message.textContent = error.message || 'Could not add show.';
      message.classList.remove('success');
    } finally { button.disabled = false; }
  });
});
