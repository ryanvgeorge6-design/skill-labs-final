const express = require('express');
const { body, param } = require('express-validator');
const { requireAuth, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createMovie, createShow, getDashboard } = require('../controllers/organisercontroller');

const router = express.Router();

router.use(requireAuth, requireRole('organiser'));

router.get('/dashboard', getDashboard);
router.post(
  '/movies',
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('duration').isFloat({ gt: 0 }).withMessage('Duration must be a positive number')
  ],
  validate,
  createMovie
);

router.post(
  '/shows',
  [
    body('movie').isMongoId().withMessage('Movie id is required'),
    body('screenName').trim().notEmpty().withMessage('Screen name is required'),
    body('startTime').isISO8601().withMessage('Start time must be a valid ISO date'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a non-negative number')
  ],
  validate,
  createShow
);

module.exports = router;
