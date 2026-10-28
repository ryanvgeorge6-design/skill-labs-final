// Build movie and showtime cards with text nodes so API content is never interpreted as markup.
document.addEventListener('DOMContentLoaded', async () => {
  try {
    if (!await Cinema.guard('user')) return;
  } catch (error) {
    Cinema.showMessage(Cinema.byId('page-message'), error.message);
    return;
  }
  const container = Cinema.byId('movies-list');
  const message = Cinema.byId('page-message');
  message.textContent = 'Loading movies…';

  try {
    const movies = Cinema.listOf(await Api.get('/movies'));
    message.textContent = movies.length ? '' : 'No movies are showing right now.';
    for (const movie of movies) {
      const card = Cinema.element('article', 'movie-card');
      const poster = Cinema.element('div', 'movie-poster');
      const imageUrl = Cinema.oneOf(movie, 'posterUrl', 'poster', 'imageUrl');
      if (imageUrl) {
        const image = document.createElement('img');
        image.src = imageUrl;
        image.alt = `${Cinema.titleOf(movie)} poster`;
        image.loading = 'lazy';
        image.referrerPolicy = 'no-referrer';
        image.addEventListener('error', () => {
          poster.replaceChildren(Cinema.element('span', 'poster-placeholder', Cinema.titleOf(movie).charAt(0)));
        }, { once: true });
        poster.append(image);
      } else {
        poster.append(Cinema.element('span', 'poster-placeholder', Cinema.titleOf(movie).charAt(0)));
      }
      const info = Cinema.element('div', 'movie-info');
      info.append(Cinema.element('h2', '', Cinema.titleOf(movie)));
      const description = Cinema.oneOf(movie, 'description', 'synopsis');
      if (description) info.append(Cinema.element('p', 'muted', description));
      const shows = Cinema.element('div', 'show-list');
      shows.append(Cinema.element('span', 'eyebrow', 'SHOWTIMES'));
      const movieId = Cinema.id(movie);
      const showResults = await Api.get(`/movies/${encodeURIComponent(movieId)}/shows`);
      const movieShows = Cinema.listOf(showResults);
      if (!movieShows.length) shows.append(Cinema.element('span', 'muted', 'No scheduled shows'));
      for (const show of movieShows) {
        const link = Cinema.element('a', 'show-option');
        link.href = `/seats.html?showId=${encodeURIComponent(Cinema.id(show))}&movie=${encodeURIComponent(Cinema.titleOf(movie))}`;
        const time = Cinema.oneOf(show, 'startsAt', 'startTime', 'datetime', 'date');
        link.append(Cinema.element('span', '', Cinema.dateTime(time)), Cinema.element('strong', '', Cinema.money(Cinema.oneOf(show, 'price', 'ticketPrice'))));
        shows.append(link);
      }
      info.append(shows);
      card.append(poster, info);
      container.append(card);
    }
  } catch (error) {
    message.textContent = error.message || 'Could not load movies.';
  }
});
