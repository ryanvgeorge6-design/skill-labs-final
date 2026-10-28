const Booking = require('../models/Booking');
const Seat = require('../models/Seat');
const Show = require('../models/Show');
const { releaseHeldSeats, freeBookedSeats } = require('../services/seatService');

async function respondWithCurrentPaymentState(booking, res) {
  if (!booking) return res.status(404).json({ message: 'Booking not found' });

  if (booking.status === 'confirmed') {
    // The booking claim happens before seat conversion, so don't report success until seats are booked.
    const bookedSeatCount = await Seat.countDocuments({
      booking: booking._id,
      status: 'booked'
    });
    if (bookedSeatCount !== booking.seats.length) {
      return res.status(409).json({ message: 'Booking is still being processed' });
    }

    return res.status(200).json({
      message: 'Payment successful',
      booking,
      alreadyProcessed: true
    });
  }
  if (booking.status === 'failed') {
    return res.status(402).json({
      message: 'Payment failed, seats released',
      booking,
      alreadyProcessed: true
    });
  }
  if (booking.status === 'cancelled') {
    return res.status(409).json({ message: 'Booking is cancelled' });
  }

  return res.status(409).json({ message: 'Booking is still being processed' });
}

async function payBooking(req, res) {
  try {
    const user = req.user.id;
    const id = req.params.id;
    // Include the owner in the lookup so another user's booking is indistinguishable from a missing one.
    let booking = await Booking.findOne({ _id: id, user });
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    // Do not call the payment gateway or mutate seats after this booking has left pending.
    if (booking.status !== 'pending') {
      return await respondWithCurrentPaymentState(booking, res);
    }

    const outcome = req.body?.outcome || (Math.random() < 0.8 ? 'success' : 'fail');
    if (outcome === 'fail') {
      booking = await Booking.findOneAndUpdate(
        { _id: id, user, status: 'pending' },
        { $set: { status: 'failed', paymentStatus: 'failed' } },
        { new: true }
      );
      if (!booking) {
        const currentBooking = await Booking.findOne({ _id: id, user });
        return await respondWithCurrentPaymentState(currentBooking, res);
      }

      await releaseHeldSeats(id);
      return res.status(402).json({ message: 'Payment failed, seats released' });
    }

    // The pending-status filter makes this a single-winner claim across simultaneous requests.
    booking = await Booking.findOneAndUpdate(
      { _id: id, user, status: 'pending' },
      { $set: { status: 'confirmed', paymentStatus: 'paid' } },
      { new: true }
    );
    if (!booking) {
      const currentBooking = await Booking.findOne({ _id: id, user });
      return await respondWithCurrentPaymentState(currentBooking, res);
    }

    const now = new Date();
    const result = await Seat.updateMany(
      {
        booking: id,
        status: 'held',
        heldBy: user,
        holdExpiresAt: { $gt: now }
      },
      { $set: { status: 'booked', holdExpiresAt: null } }
    );
    if (result.modifiedCount !== booking.seats.length) {
      // Some matching seats may already have converted, so free those as well as remaining holds.
      await Booking.findOneAndUpdate(
        { _id: id, user, status: 'confirmed' },
        { $set: { status: 'failed', paymentStatus: 'failed' } },
        { new: true }
      );
      await freeBookedSeats(id);
      await releaseHeldSeats(id);
      return res.status(410).json({ message: 'Hold expired, please select seats again' });
    }

    // Cancellation can win while seats are converting; recheck and undo the conversion if it did.
    const currentBooking = await Booking.findOne({ _id: id, user });
    if (!currentBooking || currentBooking.status !== 'confirmed') {
      await freeBookedSeats(id);
      await releaseHeldSeats(id);
      return await respondWithCurrentPaymentState(currentBooking, res);
    }

    return res.status(200).json({ message: 'Payment successful', booking });
  } catch (err) {
    console.error('Pay booking failed:', err);
    return res.status(500).json({ message: 'Server error' });
  }
}

async function getMyBookings(req, res) {
  try {
    // Compute cancellation eligibility at read time because it depends on the current show start time.
    const now = new Date();
    const bookings = await Booking.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .populate({
        path: 'show',
        select: 'screenName startTime price',
        populate: { path: 'movie', select: 'title posterUrl' }
      })
      .lean();

    const items = bookings.map(booking => ({
      ...booking,
      canCancel: booking.status === 'confirmed' &&
        Boolean(booking.show && booking.show.startTime > now)
    }));
    return res.status(200).json({ message: 'Bookings retrieved', bookings: items });
  } catch (err) {
    console.error('Get bookings failed:', err);
    return res.status(500).json({ message: 'Server error' });
  }
}

async function cancelBooking(req, res) {
  try {
    const user = req.user.id;
    const id = req.params.id;
    // Scope the lookup to the caller so booking IDs cannot be used to discover another user's data.
    let booking = await Booking.findOne({ _id: id, user });
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.status !== 'confirmed') {
      return res.status(409).json({ message: 'Only confirmed bookings can be cancelled' });
    }

    const show = await Show.findById(booking.show).select('startTime');
    if (!show) return res.status(404).json({ message: 'Show not found' });
    if (show.startTime <= new Date()) {
      return res.status(400).json({ message: 'Show has already started' });
    }

    // Recheck status atomically so concurrent cancel requests cannot both free the seats.
    booking = await Booking.findOneAndUpdate(
      { _id: id, user, status: 'confirmed' },
      { $set: { status: 'cancelled' } },
      { new: true }
    );
    if (!booking) {
      return res.status(409).json({ message: 'Booking has already been processed' });
    }

    await freeBookedSeats(id);
    return res.status(200).json({ message: 'Booking cancelled', booking });
  } catch (err) {
    console.error('Cancel booking failed:', err);
    return res.status(500).json({ message: 'Server error' });
  }
}

module.exports = { payBooking, getMyBookings, cancelBooking };
