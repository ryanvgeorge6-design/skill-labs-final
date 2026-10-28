// Keep checkout data temporary and send only the last four card digits to the mock API.
document.addEventListener('DOMContentLoaded', async () => {
  try {
    if (!await Cinema.guard('user')) return;
  } catch (error) {
    Cinema.byId('page-message').textContent = error.message;
    return;
  }
  const message = Cinema.byId('page-message');
  const form = Cinema.byId('payment-form');
  const payButton = Cinema.byId('pay-button');
  const failButton = Cinema.byId('fail-button');
  const confirmation = Cinema.byId('confirmation');
  const bookingId = Cinema.params.get('bookingId');
  let booking;
  try { booking = JSON.parse(sessionStorage.getItem('reelhouse_pending_booking') || 'null'); } catch { booking = null; }
  if (!booking || !bookingId || String(booking.bookingId) !== bookingId) {
    message.textContent = 'This payment session is unavailable or has expired. Select your seats again.';
    form.hidden = true;
    return;
  }
  const seats = Array.isArray(booking.seats) ? booking.seats.map(seat => {
    if (typeof seat === 'object') return Cinema.oneOf(seat, 'seatNumber', 'label', 'number', 'id');
    return seat;
  }) : [];
  Cinema.byId('payment-summary').textContent = `${booking.movie ? `${booking.movie} · ` : ''}Seats ${seats.join(', ')} · ${Cinema.money(booking.amount)}`;

  let timer;
  let expired = false;
  const expiry = new Date(booking.holdExpiresAt).getTime();
  if (!Number.isFinite(expiry)) {
    message.textContent = 'The hold expiry time is invalid. Return to the show and choose seats again.';
    form.hidden = true;
    return;
  }
  function updateCountdown() {
    const remaining = expiry - Date.now();
    if (remaining <= 0) {
      expired = true;
      clearInterval(timer);
      Cinema.byId('countdown').textContent = '00:00';
      message.textContent = 'Your seat hold has expired. Please return to the show and choose seats again.';
      payButton.disabled = true;
      failButton.disabled = true;
      return;
    }
    const seconds = Math.ceil(remaining / 1000);
    Cinema.byId('countdown').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }
  updateCountdown();
  timer = setInterval(updateCountdown, 1000);

  function showSuccess(result) {
    clearInterval(timer);
    form.hidden = true;
    confirmation.hidden = false;
    confirmation.append(
      Cinema.element('h2', '', 'Booking confirmed'),
      Cinema.element('p', '', `Booking ${Cinema.oneOf(result, 'id', '_id', 'bookingId') || booking.bookingId}`),
      Cinema.element('p', '', `Seats ${seats.join(', ')} · ${Cinema.money(booking.amount)}`)
    );
    const link = Cinema.element('a', 'button button-primary', 'View my bookings');
    link.href = '/bookings.html';
    confirmation.append(link);
    sessionStorage.removeItem('reelhouse_pending_booking');
  }

  async function pay(simulateFailure) {
    if (expired || Date.now() >= expiry) {
      updateCountdown();
      return;
    }
    payButton.disabled = true;
    failButton.disabled = true;
    message.textContent = simulateFailure ? 'Simulating payment failure…' : 'Processing payment…';
    try {
      const result = Cinema.unwrap(await Api.post(`/bookings/${encodeURIComponent(bookingId)}/pay`, {
        simulateFailure,
        ...(simulateFailure ? {} : { cardLast4: form.elements.cardNumber.value.replace(/\D/g, '').slice(-4) })
      })) || {};
      if (simulateFailure || result.success === false || String(result.status || '').toLowerCase() === 'failed') {
        message.textContent = result.message || 'Payment failed. Your hold is still active; you can retry before it expires.';
        payButton.textContent = 'Retry payment';
      } else {
        showSuccess(result.booking || result);
      }
    } catch (error) {
      if (error.status === 409 || error.status === 410) {
        expired = true;
        clearInterval(timer);
        message.textContent = 'Your seat hold has expired or is no longer valid. Please select seats again.';
        payButton.disabled = true;
        failButton.disabled = true;
      } else {
        message.textContent = error.message || 'Payment could not be completed. You can retry while your hold is active.';
        payButton.textContent = 'Retry payment';
      }
    } finally {
      if (!expired && !form.hidden) {
        payButton.disabled = false;
        failButton.disabled = false;
      }
    }
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    pay(false);
  });
  failButton.addEventListener('click', () => pay(true));
});
