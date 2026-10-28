const cron = require('node-cron');
const { releaseExpiredHolds, failStalePendingBookings } = require('../services/seatService');

async function runHoldExpiryOnce(now = new Date()) {
  const [releasedSeats, failedBookings] = await Promise.all([
    releaseExpiredHolds(now),
    failStalePendingBookings(now)
  ]);
  return { releasedSeats, failedBookings };
}

function startHoldExpiryJob() {
  return cron.schedule('* * * * *', async () => {
    try {
      const counts = await runHoldExpiryOnce();
      if (counts.releasedSeats > 0) {
        console.log(`Released ${counts.releasedSeats} expired seat holds`);
      }
      if (counts.failedBookings > 0) {
        console.log(`Failed ${counts.failedBookings} stale bookings`);
      }
    } catch (err) {
      console.error('Hold expiry job failed:', err);
    }
  });
}

module.exports = { startHoldExpiryJob, runHoldExpiryOnce };
