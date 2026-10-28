require('dotenv').config({ quiet: true });
const path = require('path');
const mongoose = require('mongoose');

const action = process.argv[2];
const arg = process.argv[3];

async function countSeats(showId) {
  const Seat = require(path.join(__dirname, '..', 'src', 'models', 'seat'));
  await mongoose.connect(process.env.MONGO_URI);
  const count = await Seat.countDocuments({ show: new mongoose.Types.ObjectId(showId) });
  console.log(String(count));
  await mongoose.disconnect();
}

async function createSecondOrganiser(email) {
  const bcrypt = require('bcryptjs');
  const User = require(path.join(__dirname, '..', 'src', 'models', 'user'));
  await mongoose.connect(process.env.MONGO_URI);
  const user = await User.create({
    name: 'Second Org',
    email,
    passwordHash: await bcrypt.hash('password123', 12),
    role: 'organiser'
  });
  console.log(user._id.toString());
  await mongoose.disconnect();
}

async function createBooking() {
  const Booking = require(path.join(__dirname, '..', 'src', 'models', 'booking'));
  await mongoose.connect(process.env.MONGO_URI);
  const booking = await Booking.create({
    user: process.env.BOOKING_USER_ID,
    show: process.env.BOOKING_SHOW_ID,
    seats: ['A1'],
    amount: Number(process.env.BOOKING_AMOUNT),
    status: 'confirmed',
    paymentStatus: 'paid',
    createdAt: new Date()
  });
  console.log(booking._id.toString());
  await mongoose.disconnect();
}

async function createPendingBooking() {
  const Booking = require(path.join(__dirname, '..', 'src', 'models', 'booking'));
  await mongoose.connect(process.env.MONGO_URI);
  const booking = await Booking.create({
    user: process.env.BOOKING_PENDING_USER_ID,
    show: process.env.BOOKING_PENDING_SHOW_ID,
    seats: ['A2'],
    amount: Number(process.env.BOOKING_PENDING_AMOUNT),
    status: 'pending',
    paymentStatus: 'pending',
    createdAt: new Date()
  });
  console.log(booking._id.toString());
  await mongoose.disconnect();
}

async function deleteBookings(showId) {
  const Booking = require(path.join(__dirname, '..', 'src', 'models', 'booking'));
  await mongoose.connect(process.env.MONGO_URI);
  await Booking.deleteMany({ show: showId });
  console.log('ok');
  await mongoose.disconnect();
}

async function deleteSecondOrg(email) {
  const User = require(path.join(__dirname, '..', 'src', 'models', 'user'));
  await mongoose.connect(process.env.MONGO_URI);
  await User.deleteOne({ email });
  console.log('ok');
  await mongoose.disconnect();
}

(async () => {
  try {
    switch (action) {
      case 'count-seats':
        await countSeats(arg);
        break;
      case 'create-second-org':
        await createSecondOrganiser(arg);
        break;
      case 'create-booking':
        await createBooking();
        break;
      case 'create-pending-booking':
        await createPendingBooking();
        break;
      case 'delete-bookings':
        await deleteBookings(arg);
        break;
      case 'delete-second-org':
        await deleteSecondOrg(arg);
        break;
      default:
        console.error('Unknown action');
        process.exit(1);
    }
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
})();
