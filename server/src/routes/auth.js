const router = require('express').Router();

const users = [
  {
    id: 1,
    name: 'Demo User',
    email: 'demo@reelhouse.com',
    password: 'demo123',
    role: 'customer'
  }
];

router.get('/health', (req, res) => {
  res.json({ ok: true, service: 'auth' });
});

router.post('/register', (req, res) => {
  const { name, email, password } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email, and password are required.' });
  }

  const exists = users.some((user) => user.email.toLowerCase() === email.toLowerCase());
  if (exists) {
    return res.status(409).json({ message: 'User already exists.' });
  }

  const newUser = {
    id: Date.now(),
    name,
    email,
    password,
    role: 'customer'
  };

  users.push(newUser);

  return res.status(201).json({
    message: 'Account created successfully.',
    user: { id: newUser.id, name, email, role: 'customer' },
    token: 'demo-token-' + newUser.id
  });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const user = users.find((item) => item.email.toLowerCase() === email.toLowerCase() && item.password === password);

  if (!user) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  return res.json({
    message: 'Login successful',
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    },
    token: 'demo-token-' + user.id
  });
});

module.exports = router;
