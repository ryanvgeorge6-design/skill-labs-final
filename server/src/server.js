require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');
const { startHoldExpiryJob } = require('./jobs/holdExpiry');

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    if (process.env.NODE_ENV !== 'test') startHoldExpiryJob();
    app.listen(process.env.PORT || 5000, () => console.log('Server running on port ' + (process.env.PORT || 5000)));
  })
  .catch(err => console.error('DB connection failed:', err.message));
