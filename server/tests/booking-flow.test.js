const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const Booking = require('../src/models/Booking');
const Seat = require('../src/models/Seat');
const Show = require('../src/models/Show');

const SHOW_ID = '507f1f77bcf86cd799439011';
const BOOKING_ID = '507f1f77bcf86cd799439012';
const USER_ID = '507f1f77bcf86cd799439013';

process.env.JWT_SECRET = 'booking-flow-test-secret';
const userToken = jwt.sign({ id: USER_ID, role: 'user' }, process.env.JWT_SECRET);

function showQuery(show) {
  return {
    select: jest.fn().mockResolvedValue(show),
    then(resolve, reject) {
      return Promise.resolve(show).then(resolve, reject);
    }
  };
}

function authHeader(token = userToken) {
  return `Bearer ${token}`;
}

beforeEach(() => {
  jest.restoreAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('booking flow routes', () => {
  test('returns 404 when another user tries to pay or cancel a booking', async () => {
    jest.spyOn(Booking, 'findOne').mockResolvedValue(null);

    const payResponse = await request(app)
      .post(`/api/bookings/${BOOKING_ID}/pay`)
      .set('Authorization', authHeader());
    const cancelResponse = await request(app)
      .post(`/api/bookings/${BOOKING_ID}/cancel`)
      .set('Authorization', authHeader());

    expect(payResponse.status).toBe(404);
    expect(payResponse.body).toHaveProperty('message');
    expect(cancelResponse.status).toBe(404);
    expect(cancelResponse.body).toHaveProperty('message');
    expect(Booking.findOne).toHaveBeenCalledWith({ _id: BOOKING_ID, user: USER_ID });
  });

  test('paying twice returns the confirmed booking as already processed', async () => {
    const storedBooking = {
      _id: BOOKING_ID,
      user: USER_ID,
      show: SHOW_ID,
      seats: ['A1'],
      amount: 250,
      status: 'pending',
      paymentStatus: 'pending'
    };
    jest.spyOn(Booking, 'findOne').mockImplementation(async () => ({ ...storedBooking }));
    jest.spyOn(Booking, 'findOneAndUpdate').mockImplementation(async (filter, update) => {
      expect(filter).toMatchObject({ _id: BOOKING_ID, user: USER_ID, status: 'pending' });
      Object.assign(storedBooking, update.$set);
      return { ...storedBooking };
    });
    jest.spyOn(Seat, 'updateMany').mockResolvedValue({ modifiedCount: 1 });
    jest.spyOn(Seat, 'countDocuments').mockResolvedValue(1);

    const firstResponse = await request(app)
      .post(`/api/bookings/${BOOKING_ID}/pay`)
      .set('Authorization', authHeader())
      .send({ outcome: 'success' });
    const secondResponse = await request(app)
      .post(`/api/bookings/${BOOKING_ID}/pay`)
      .set('Authorization', authHeader())
      .send({ outcome: 'success' });

    expect(firstResponse.status).toBe(200);
    expect(firstResponse.body.booking.status).toBe('confirmed');
    expect(secondResponse.status).toBe(200);
    expect(secondResponse.body.alreadyProcessed).toBe(true);
    expect(Seat.updateMany).toHaveBeenCalledTimes(1);
  });

  test('expired hold fails payment and frees any remaining seats', async () => {
    const storedBooking = {
      _id: BOOKING_ID,
      user: USER_ID,
      show: SHOW_ID,
      seats: ['A1'],
      status: 'pending',
      paymentStatus: 'pending'
    };
    jest.spyOn(Booking, 'findOne').mockImplementation(async () => ({ ...storedBooking }));
    jest.spyOn(Booking, 'findOneAndUpdate').mockImplementation(async (filter, update) => {
      Object.assign(storedBooking, update.$set);
      return { ...storedBooking };
    });
    jest.spyOn(Seat, 'updateMany').mockResolvedValue({ modifiedCount: 0 });

    const response = await request(app)
      .post(`/api/bookings/${BOOKING_ID}/pay`)
      .set('Authorization', authHeader())
      .send({ outcome: 'success' });

    expect(response.status).toBe(410);
    expect(response.body.message).toBe('Hold expired, please select seats again');
    expect(storedBooking).toMatchObject({ status: 'failed', paymentStatus: 'failed' });
    expect(Seat.updateMany).toHaveBeenCalledTimes(3);
    expect(Seat.updateMany).toHaveBeenNthCalledWith(
      2,
      { booking: BOOKING_ID, status: 'booked' },
      { $set: { status: 'available', heldBy: null, holdExpiresAt: null, booking: null } }
    );
    expect(Seat.updateMany).toHaveBeenNthCalledWith(
      3,
      { booking: BOOKING_ID, status: 'held' },
      { $set: { status: 'available', heldBy: null, holdExpiresAt: null, booking: null } }
    );
  });

  test('cancelling a confirmed booking frees its booked seats', async () => {
    const storedBooking = {
      _id: BOOKING_ID,
      user: USER_ID,
      show: SHOW_ID,
      seats: ['A1'],
      status: 'confirmed',
      paymentStatus: 'paid'
    };
    jest.spyOn(Booking, 'findOne').mockResolvedValue(storedBooking);
    jest.spyOn(Booking, 'findOneAndUpdate').mockResolvedValue({
      ...storedBooking,
      status: 'cancelled'
    });
    jest.spyOn(Show, 'findById').mockReturnValue(showQuery({
      startTime: new Date(Date.now() + 60_000)
    }));
    jest.spyOn(Seat, 'updateMany').mockResolvedValue({ modifiedCount: 1 });

    const response = await request(app)
      .post(`/api/bookings/${BOOKING_ID}/cancel`)
      .set('Authorization', authHeader());

    expect(response.status).toBe(200);
    expect(response.body.booking.status).toBe('cancelled');
    expect(Seat.updateMany).toHaveBeenCalledWith(
      { booking: BOOKING_ID, status: 'booked' },
      { $set: { status: 'available', heldBy: null, holdExpiresAt: null, booking: null } }
    );
  });

  test('hold returns 409 when a requested seat is already held', async () => {
    const show = {
      _id: SHOW_ID,
      startTime: new Date(Date.now() + 60_000),
      price: 250
    };
    const booking = { _id: BOOKING_ID, user: USER_ID, show: SHOW_ID, seats: ['A1'] };
    jest.spyOn(Show, 'findById').mockReturnValue(showQuery(show));
    jest.spyOn(Booking, 'create').mockResolvedValue(booking);
    jest.spyOn(Seat, 'updateMany').mockResolvedValue({ modifiedCount: 0 });
    jest.spyOn(Booking, 'findOneAndUpdate').mockResolvedValue({
      ...booking,
      status: 'failed',
      paymentStatus: 'failed'
    });

    const response = await request(app)
      .post(`/api/shows/${SHOW_ID}/hold`)
      .set('Authorization', authHeader())
      .send({ seats: ['A1', 'A1'] });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe('One or more seats are no longer available');
    expect(Booking.create).toHaveBeenCalledWith(expect.objectContaining({
      user: USER_ID,
      show: SHOW_ID,
      seats: ['A1'],
      amount: 250,
      status: 'pending'
    }));
    expect(Seat.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        show: SHOW_ID,
        seatLabel: { $in: ['A1'] },
        $or: expect.arrayContaining([
          { status: 'available' },
          { status: 'held', holdExpiresAt: { $lt: expect.any(Date) } }
        ])
      }),
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'held',
          heldBy: USER_ID,
          booking: BOOKING_ID,
          holdExpiresAt: expect.any(Date)
        })
      })
    );
  });
});
