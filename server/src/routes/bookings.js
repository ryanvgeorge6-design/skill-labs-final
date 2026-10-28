const router = require('express').Router();
const { body, param, validationResult } = require('express-validator');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  payBooking,
  getMyBookings,
  cancelBooking
} = require('../controllers/bookingController');

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: 'Invalid request', errors: errors.array() });
  }
  next();
}

router.get('/my', requireAuth, requireRole('user'), getMyBookings);
router.post(
  '/:id/pay',
  requireAuth,
  requireRole('user'),
  param('id').isMongoId(),
  body('outcome').optional().isIn(['success', 'fail']),
  validate,
  payBooking
);
router.post(
  '/:id/cancel',
  requireAuth,
  requireRole('user'),
  param('id').isMongoId(),
  validate,
  cancelBooking
);

module.exports = router;
