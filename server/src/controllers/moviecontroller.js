const Movie = require('../models/movie');
const Show = require('../models/show');

async function getMovies(req, res) {
  try {
    const movies = await Movie.find().sort({ createdAt: -1 });
    return res.json({ movies });
  } catch (err) {
    console.error('getMovies error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
}

async function getMovieShows(req, res) {
  try {
    const { id } = req.params;
    const movie = await Movie.findById(id);
    if (!movie) return res.status(404).json({ message: 'Movie not found' });

    const shows = await Show.find({ movie: id, startTime: { $gte: new Date() } }).sort({ startTime: 1 });
    return res.json({ shows });
  } catch (err) {
    console.error('getMovieShows error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
}

module.exports = { getMovies, getMovieShows };
