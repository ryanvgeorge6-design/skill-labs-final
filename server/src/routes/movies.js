const express = require('express');
const { param } = require('express-validator');
const { getMovies, getMovieShows } = require('../controllers/moviecontroller');
const validate = require('../middleware/validate');

const router = express.Router();

router.get('/', getMovies);
router.get(
  '/:id/shows',
  [param('id').isMongoId().withMessage('Invalid movie id')],
  validate,
  getMovieShows
);

module.exports = router;
