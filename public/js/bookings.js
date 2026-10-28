// Use server-provided cancellation eligibility when present; otherwise allow only paid bookings.
document.addEventListener('DOMContentLoaded', async () => {
  try {
    if (!await Cinema.guard('user')) return;
  } catch (error) {
    Cinema.byId('page-message').textContent = error.message;
    return;
  }
  const container = Cinema.byId('bookings-list');
  const message = Cinema.byId('page-message');
  message.textContent = 'Loading bookings…';

  async function loadBookings() {
    container.replaceChildren();
    const bookings = Cinema.listOf(await Api.get('/bookings/my'));
    message.textContent = bookings.length ? '' : 'You do not have any bookings yet.';
    for (const booking of bookings) {
      const card = Cinema.element('article', 'panel booking-card');
      const detail = Cinema.element('div', 'booking-details');
      const movieTitle = Cinema.oneOf(booking, 'movieTitle', 'movieName') || (booking.movie && Cinema.titleOf(booking.movie)) || 'Movie booking';
      detail.append(Cinema.element('h2', '', movieTitle));
      const bookingSeats = (booking.seats || []).map(seat => typeof seat === 'object' ? Cinema.oneOf(seat, 'seatNumber', 'label', 'number', 'id') : seat).filter(Boolean);
      detail.append(Cinema.element('div', '', `Seats: ${bookingSeats.join(', ') || 'Not specified'}`));
      detail.append(Cinema.element('div', '', `Show: ${Cinema.dateTime(Cinema.oneOf(booking, 'startsAt', 'showTime') || (booking.show && Cinema.oneOf(booking.show, 'startsAt', 'startTime')))}`));
      detail.append(Cinema.element('div', '', `Total: ${Cinema.money(Cinema.oneOf(booking, 'amount', 'total', 'totalPrice'))}`));
      const actions = Cinema.element('div', 'booking-actions');
      const status = String(booking.status || 'pending').toLowerCase();
      actions.append(Cinema.element('span', `badge badge-${status}`, status));
      const canCancel = booking.canCancel !== undefined
        ? Boolean(booking.canCancel)
        : ['confirmed', 'paid'].includes(status);
      if (canCancel) {
        const cancel = Cinema.element('button', 'button button-secondary', 'Cancel booking');
        cancel.type = 'button';
        cancel.addEventListener('click', async () => {
          if (!window.confirm('Cancel this booking? This action may not be reversible.')) return;
          cancel.disabled = true;
          try {
            await Api.post(`/bookings/${encodeURIComponent(Cinema.id(booking))}/cancel`, {});
            await loadBookings();
          } catch (error) {
            cancel.disabled = false;
            message.textContent = error.message || 'Could not cancel this booking.';
          }
        });
        actions.append(cancel);
      }
      card.append(detail, actions);
      container.append(card);
    }
  }

  try { await loadBookings(); } catch (error) { message.textContent = error.message || 'Could not load bookings.'; }
});
