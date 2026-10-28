const Movie = require('../models/movie');
const Show = require('../models/show');
const Seat = require('../models/seat');
const Booking = require('../models/booking');

async function createMovie(req, res) {
  try {
    const { title, description = '', duration, posterUrl = '' } = req.body;
    if (!title || !String(title).trim()) {
      return res.status(400).json({ message: 'Title is required' });
    }
    if (!duration || Number(duration) <= 0) {
      return res.status(400).json({ message: 'Duration must be a positive number' });
    }

    const movie = await Movie.create({
      title: String(title).trim(),
      description: String(description).trim(),
      duration: Number(duration),
      posterUrl: String(posterUrl).trim(),
      organiser: req.user.id
    });
    return res.status(201).json({ movie });
  } catch (err) {
    console.error('createMovie error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
}

async function createShow(req, res) {
  try {
    const { movie, screenName, startTime, price } = req.body;
    if (!movie) return res.status(400).json({ message: 'Movie id is required' });
    if (!screenName || !String(screenName).trim()) return res.status(400).json({ message: 'Screen name is required' });
    if (!startTime) return res.status(400).json({ message: 'Start time is required' });
    if (price === undefined || Number(price) < 0) return res.status(400).json({ message: 'Price must be a non-negative number' });

    const movieDoc = await Movie.findById(movie);
    if (!movieDoc) return res.status(404).json({ message: 'Movie not found' });
    if (movieDoc.organiser.toString() !== req.user.id) return res.status(403).json({ message: 'Forbidden' });

    const show = await Show.create({
      movie,
      screenName: String(screenName).trim(),
      startTime: new Date(startTime),
      price: Number(price),
      organiser: req.user.id
    });

    const rows = 'ABCDEFGH'.split('');
    const seats = [];
    rows.forEach((row) => {
      for (let i = 1; i <= 10; i += 1) {
        seats.push({ show: show._id, seatLabel: `${row}${i}`, status: 'available' });
      }
    });
    await Seat.insertMany(seats);
    return res.status(201).json({ show });
  } catch (err) {
    console.error('createShow error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
}

async function getDashboard(req, res) {
  try {
    const shows = await Show.find({ organiser: req.user.id }).lean();
    const showIds = shows.map((s) => s._id);

    const summary = await Booking.aggregate([
      { $match: { show: { $in: showIds }, status: 'confirmed' } },
      {
        $group: {
          _id: '$show',
          revenue: { $sum: '$amount' },
          ticketsSold: { $sum: { $size: '$seats' } },
          bookingCount: { $sum: 1 }
        }
      }
    ]);

    const bookingsPerShow = shows.map((show) => {
      const item = summary.find((s) => s._id.toString() === show._id.toString());
      return {
        showId: show._id,
        screenName: show.screenName,
        revenue: item ? item.revenue : 0,
        ticketsSold: item ? item.ticketsSold : 0,
        bookingCount: item ? item.bookingCount : 0
      };
    });

    const occupancyPerShow = await Promise.all(shows.map(async (show) => {
      const totalSeats = await Seat.countDocuments({ show: show._id });
      const bookedSeats = await Seat.countDocuments({ show: show._id, status: 'booked' });
      return {
        showId: show._id,
        screenName: show.screenName,
        totalSeats,
        bookedSeats,
        occupancy: totalSeats ? Number(((bookedSeats / totalSeats) * 100).toFixed(2)) : 0
      };
    }));

    const revenue = summary.reduce((sum, item) => sum + (item.revenue || 0), 0);
    const ticketsSold = summary.reduce((sum, item) => sum + (item.ticketsSold || 0), 0);

    return res.json({ revenue, ticketsSold, bookingsPerShow, occupancyPerShow });
  } catch (err) {
    console.error('getDashboard error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
}

module.exports = { createMovie, createShow, getDashboard };
