const router = require('express').Router();
const { body, param, validationResult } = require('express-validator');
const { requireAuth, requireRole } = require('../middleware/auth');
const { MAX_SEATS_PER_BOOKING } = require('../config/booking');
const {
  getUpcomingShows,
  getShowSeats,
  holdSeats
} = require('../controllers/seatController');

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: 'Invalid request', errors: errors.array() });
  }
  next();
}

router.get('/', getUpcomingShows);
router.get(
  '/:id/seats',
  param('id').isMongoId(),
  validate,
  getShowSeats
);
router.post(
  '/:id/hold',
  requireAuth,
  requireRole('user'),
  param('id').isMongoId(),
  body('seats').isArray({ min: 1, max: MAX_SEATS_PER_BOOKING }),
  body('seats.*').isString().trim().notEmpty(),
  validate,
  holdSeats
);

module.exports = router;
