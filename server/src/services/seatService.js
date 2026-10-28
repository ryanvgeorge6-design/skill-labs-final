const Seat = require('../models/Seat');
const Booking = require('../models/Booking');

const HOLD_MINUTES = 5;

async function releaseHeldSeats(bookingId) {
  // Match held seats by booking so retries cannot release unrelated seats.
  return Seat.updateMany(
    { booking: bookingId, status: 'held' },
    { $set: { status: 'available', heldBy: null, holdExpiresAt: null, booking: null } }
  );
}

async function freeBookedSeats(bookingId) {
  // Only free seats still booked by this booking, leaving any later state untouched.
  return Seat.updateMany(
    { booking: bookingId, status: 'booked' },
    { $set: { status: 'available', heldBy: null, holdExpiresAt: null, booking: null } }
  );
}

async function releaseExpiredHolds(now = new Date()) {
  // Expiry is part of the filter so a renewed hold cannot be cleared by an old run.
  const result = await Seat.updateMany(
    { status: 'held', holdExpiresAt: { $lt: now } },
    { $set: { status: 'available', heldBy: null, holdExpiresAt: null, booking: null } }
  );
  return result.modifiedCount;
}

async function failStalePendingBookings(now = new Date()) {
  // Use the provided five-minute hold duration as the pending-payment deadline.
  const staleBefore = new Date(now.getTime() - HOLD_MINUTES * 60 * 1000);
  const result = await Booking.updateMany(
    { status: 'pending', createdAt: { $lt: staleBefore } },
    { $set: { status: 'failed', paymentStatus: 'failed' } }
  );
  return result.modifiedCount;
}

module.exports = {
  releaseHeldSeats,
  freeBookedSeats,
  releaseExpiredHolds,
  failStalePendingBookings
};
