require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Movie = require('./models/Movie');
const Show = require('./models/Show');
const Seat = require('./models/Seat');

async function upsertUser(email, name, role, passwordHash) {
  return User.findOneAndUpdate(
    { email },
    { $setOnInsert: { name, email, role, passwordHash } },
    { upsert: true, returnDocument: 'after' }
  );
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const passwordHash = await bcrypt.hash('password123', 10);

  const organiser = await upsertUser('organiser@test.com', 'Test Organiser', 'organiser', passwordHash);
  const user = await upsertUser('user@test.com', 'Test User', 'user', passwordHash);

  let movie = await Movie.findOne({ title: 'Test Movie', organiser: organiser._id });
  if (!movie) {
    movie = await Movie.create({
      title: 'Test Movie',
      description: 'Seed data for testing',
      duration: 120,
      organiser: organiser._id
    });
  }

  let show = await Show.findOne({ movie: movie._id });
  if (!show) {
    show = await Show.create({
      movie: movie._id,
      screenName: 'Screen 1',
      startTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      price: 250,
      organiser: organiser._id
    });
  }

  // Rows A-H, 10 seats each. Upsert so running the seed twice never duplicates seats.
  const ops = [];
  for (const row of 'ABCDEFGH') {
    for (let n = 1; n <= 10; n++) {
      ops.push({
        updateOne: {
          filter: { show: show._id, seatLabel: row + n },
          update: { $setOnInsert: { status: 'available' } },
          upsert: true
        }
      });
    }
  }
  await Seat.bulkWrite(ops);

  console.log('Seed done');
  console.log('Organiser login: organiser@test.com / password123');
  console.log('User login:      user@test.com / password123');
  console.log('Show id:', show._id.toString());
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
