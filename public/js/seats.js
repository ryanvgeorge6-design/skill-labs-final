// The server remains authoritative for availability; refresh after a hold conflict.
document.addEventListener('DOMContentLoaded', async () => {
  try {
    if (!await Cinema.guard('user')) return;
  } catch (error) {
    Cinema.byId('page-message').textContent = error.message;
    return;
  }
  const showId = Cinema.params.get('showId');
  const map = Cinema.byId('seat-map');
  const message = Cinema.byId('page-message');
  const holdButton = Cinema.byId('hold-button');
  const selectedLabel = Cinema.byId('selected-seats');
  const totalLabel = Cinema.byId('total-price');
  const selected = new Map();
  let seatData = [];

  if (!showId) {
    message.textContent = 'Choose a showtime from the movies page first.';
    return;
  }
  Cinema.byId('show-detail').textContent = Cinema.params.get('movie') || '';

  const seatId = seat => Cinema.oneOf(seat, 'id', '_id', 'seatId', 'number', 'seatNumber', 'label');
  const seatName = seat => String(Cinema.oneOf(seat, 'seatNumber', 'label', 'number', 'name', 'id'));
  const statusOf = seat => String(seat.status || 'available').toLowerCase();
  function updateSelection() {
    const entries = Array.from(selected.entries());
    selectedLabel.textContent = entries.map(([, seat]) => seatName(seat)).join(', ') || 'None';
    totalLabel.textContent = Cinema.money(entries.reduce((sum, [, seat]) => sum + Number(Cinema.oneOf(seat, 'price', 'ticketPrice') || 0), 0));
    holdButton.disabled = entries.length === 0;
  }
  function renderSeats() {
    map.replaceChildren();
    for (const seat of seatData) {
      const key = String(seatId(seat));
      const status = statusOf(seat);
      const isSelected = selected.has(key);
      const button = Cinema.element('button', `seat ${isSelected ? 'selected' : status}`);
      button.type = 'button';
      button.textContent = seatName(seat);
      button.title = `${seatName(seat)} · ${status}`;
      button.setAttribute('aria-pressed', String(isSelected));
      button.disabled = status !== 'available' && !isSelected;
      button.addEventListener('click', () => {
        if (selected.has(key)) selected.delete(key);
        else if (selected.size >= 6) {
          message.textContent = 'You can select up to 6 seats.';
          return;
        } else selected.set(key, seat);
        message.textContent = '';
        renderSeats();
        updateSelection();
      });
      map.append(button);
    }
  }
  async function refreshMap() {
    const response = await Api.get(`/shows/${encodeURIComponent(showId)}/seats`);
    seatData = Cinema.listOf(response);
    renderSeats();
    updateSelection();
  }

  message.textContent = 'Loading seats…';
  try {
    await refreshMap();
    message.textContent = seatData.length ? '' : 'No seats are available for this show.';
  } catch (error) {
    message.textContent = error.message || 'Could not load the seat map.';
    return;
  }

  holdButton.addEventListener('click', async () => {
    if (!selected.size) return;
    holdButton.disabled = true;
    holdButton.textContent = 'Holding seats…';
    try {
      const seats = Array.from(selected.keys());
      const result = Cinema.unwrap(await Api.post(`/shows/${encodeURIComponent(showId)}/hold`, { seats }));
      const booking = result.booking || result;
      const bookingId = Cinema.oneOf(booking, 'id', '_id', 'bookingId');
      if (!bookingId) throw new Error('The server did not return a booking ID for the held seats.');
      const holdExpiresAt = booking.holdExpiresAt || booking.expiresAt || result.holdExpiresAt || result.expiresAt;
      if (!holdExpiresAt || Number.isNaN(new Date(holdExpiresAt).getTime())) {
        throw new Error('The server did not return a valid hold expiry time.');
      }
      const state = {
        bookingId,
        showId,
        seats: booking.seats || seats,
        amount: Cinema.oneOf(booking, 'amount', 'total', 'totalPrice') ?? Array.from(selected.values()).reduce((sum, seat) => sum + Number(Cinema.oneOf(seat, 'price', 'ticketPrice') || 0), 0),
        holdExpiresAt,
        movie: Cinema.params.get('movie') || ''
      };
      sessionStorage.setItem('reelhouse_pending_booking', JSON.stringify(state));
      location.href = `/payment.html?bookingId=${encodeURIComponent(bookingId)}`;
    } catch (error) {
      if (error.status === 409) {
        const taken = Cinema.oneOf(error.data, 'seats', 'takenSeats', 'unavailableSeats');
        message.textContent = `Some seats were just taken${Array.isArray(taken) && taken.length ? `: ${taken.join(', ')}` : ''}. The seat map has been refreshed.`;
        try { await refreshMap(); } catch (refreshError) { message.textContent += ` ${refreshError.message}`; }
      } else {
        message.textContent = error.message || 'Could not hold the selected seats.';
      }
    } finally {
      holdButton.textContent = 'Hold & Pay';
      updateSelection();
    }
  });
});
