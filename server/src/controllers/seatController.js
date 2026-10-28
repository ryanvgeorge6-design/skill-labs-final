const Booking = require('../models/Booking');
const Seat = require('../models/Seat');
const Show = require('../models/Show');
const { HOLD_MINUTES, MAX_SEATS_PER_BOOKING } = require('../config/booking');
const { releaseHeldSeats } = require('../services/seatService');

async function getUpcomingShows(req, res) {
  try {
    const shows = await Show.find({ startTime: { $gt: new Date() } })
      .populate('movie', 'title posterUrl')
      .lean();
    return res.status(200).json({ message: 'Upcoming shows retrieved', shows });
  } catch (err) {
    console.error('Get upcoming shows failed:', err);
    return res.status(500).json({ message: 'Server error' });
  }
}

async function getShowSeats(req, res) {
  try {
    const show = await Show.findById(req.params.id);
    if (!show) return res.status(404).json({ message: 'Show not found' });

    const now = new Date();
    const seats = await Seat.find({ show: req.params.id })
      .select('seatLabel status holdExpiresAt')
      .lean();
    const availableSeats = seats.map(({ seatLabel, status, holdExpiresAt }) => ({
      seatLabel,
      status: status === 'held' && holdExpiresAt && holdExpiresAt < now
        ? 'available'
        : status
    }));

    return res.status(200).json({ message: 'Seats retrieved', seats: availableSeats });
  } catch (err) {
    console.error('Get show seats failed:', err);
    return res.status(500).json({ message: 'Server error' });
  }
}

async function holdSeats(req, res) {
  try {
    const show = await Show.findById(req.params.id);
    if (!show) return res.status(404).json({ message: 'Show not found' });
    const now = new Date();
    if (show.startTime <= now) {
      return res.status(400).json({ message: 'Show has already started' });
    }

    const seats = [...new Set(req.body.seats)];
    const booking = await Booking.create({
      user: req.user.id,
      show: show._id,
      seats,
      amount: show.price * seats.length,
      status: 'pending'
    });
    const holdExpiresAt = new Date(now.getTime() + HOLD_MINUTES * 60 * 1000);

    // Put availability and expired-hold conditions in the atomic update to avoid seat races.
    const result = await Seat.updateMany(
      {
        show: show._id,
        seatLabel: { $in: seats },
        $or: [
          { status: 'available' },
          { status: 'held', holdExpiresAt: { $lt: now } }
        ]
      },
      {
        $set: {
          status: 'held',
          heldBy: req.user.id,
          holdExpiresAt,
          booking: booking._id
        }
      }
    );

    if (result.modifiedCount !== seats.length) {
      await releaseHeldSeats(booking._id);
      await Booking.findOneAndUpdate(
        { _id: booking._id, status: 'pending' },
        { $set: { status: 'failed', paymentStatus: 'failed' } },
        { new: true }
      );
      return res.status(409).json({ message: 'One or more seats are no longer available' });
    }

    return res.status(201).json({ message: 'Seats held', booking, holdExpiresAt });
  } catch (err) {
    console.error('Hold seats failed:', err);
    return res.status(500).json({ message: 'Server error' });
  }
}

module.exports = { getUpcomingShows, getShowSeats, holdSeats };
