const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const sanitize = require('./middleware/sanitize');

const app = express();

app.set('trust proxy', 1);
app.set('query parser', 'simple');

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10kb' }));
app.use(sanitize);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/movies', require('./routes/movies'));
app.use('/api/organiser', require('./routes/organiser'));

app.use(express.static(path.join(__dirname, '../../public')));

app.use((err, req, res, next) => {
  console.error(err);
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Invalid JSON body' });
  }
  return res.status(500).json({ message: 'Server error' });
});

module.exports = app;
