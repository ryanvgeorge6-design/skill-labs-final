const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', require('./routes/auth'));            // Ryan
app.use('/api/movies', require('./routes/movies'));        // Ryan
app.use('/api/shows', require('./routes/shows'));          // Shabeeb
app.use('/api/bookings', require('./routes/bookings'));    // Shabeeb
app.use('/api/organiser', require('./routes/organiser'));  // Ryan

app.use(express.static(path.join(__dirname, '../../public')));
module.exports = app;
