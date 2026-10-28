const mongoose = require('mongoose');

const showSchema = new mongoose.Schema({
  movie: { type: mongoose.Schema.Types.ObjectId, ref: 'Movie', required: true },
  screenName: { type: String, required: true },
  startTime: { type: Date, required: true },
  price: { type: Number, required: true, min: 0 },
  organiser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Show', showSchema);
