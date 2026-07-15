// Simple validation middleware

function validateRegistration(req, res, next) {
  // Check registration toggle
  const registrationOpen = process.env.REGISTRATION_OPEN;
  if (registrationOpen === 'false' || registrationOpen === false) {
    return res.status(403).json({ error: 'Registration is currently closed' });
  }

  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
  if (typeof email !== 'string' || !email.includes('@')) return res.status(400).json({ error: 'Invalid email' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  // Pass name through if provided (frontend sends 'name' mapped from 'username')
  next();
}

function validateLogin(req, res, next) {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
  next();
}

function validateWalletLogin(req, res, next) {
  const { address, signature } = req.body;
  if (!address || !signature) return res.status(400).json({ error: 'address and signature are required' });
  next();
}

module.exports = { validateRegistration, validateLogin, validateWalletLogin };
