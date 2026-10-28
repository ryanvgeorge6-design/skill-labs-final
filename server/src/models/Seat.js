const mongoose = require('mongoose');

// One document per seat: single-document updates are atomic in MongoDB,
// which is what prevents two users from getting the same seat.
const seatSchema = new mongoose.Schema({
  show: { type: mongoose.Schema.Types.ObjectId, ref: 'Show', required: true },
  seatLabel: { type: String, required: true }, // A1, A2...
  status: { type: String, enum: ['available', 'held', 'booked'], default: 'available' },
  heldBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  holdExpiresAt: { type: Date, default: null },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null }
});

seatSchema.index({ show: 1, seatLabel: 1 }, { unique: true });

module.exports = mongoose.model('Seat', seatSchema);
