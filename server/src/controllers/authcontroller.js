const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');

function signToken(user) {
  return jwt.sign(
    { id: user._id.toString(), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function serializeUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role
  };
}

async function register(req, res) {
  try {
    const { name, email, password, role } = req.body;
    const requestedRole = role === 'organiser' ? 'organiser' : 'user';

    if (requestedRole === 'organiser') {
      const expectedCode = process.env.ORGANISER_CODE || '';
      const providedCode = req.body.organiserCode || '';
      if (!expectedCode || providedCode !== expectedCode) {
        return res.status(403).json({ message: 'Invalid organiser code' });
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      name,
      email: String(email).toLowerCase().trim(),
      passwordHash,
      role: requestedRole
    });

    const token = signToken(user);
    return res.status(201).json({ token, user: serializeUser(user) });
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ message: 'Email already registered' });
    }
    console.error('register error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
}

async function login(req, res) {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = req.body.password || '';
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = signToken(user);
    return res.json({ token, user: serializeUser(user) });
  } catch (err) {
    console.error('login error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
}

async function me(req, res) {
  try {
    const user = await User.findById(req.user.id).select('-passwordHash');
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json({ user: serializeUser(user) });
  } catch (err) {
    console.error('me error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
}

module.exports = { register, login, me };
