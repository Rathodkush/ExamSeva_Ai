const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }

    try {
      const user = await User.findById(decoded.userId);
      if (!user || user.isActive === false) {
        return res.status(403).json({ error: 'User account is inactive or not found.' });
      }
      req.user = {
        userId: decoded.userId,
        email: decoded.email,
        role: user.role
      };
      next();
    } catch (err) {
      return res.status(403).json({ error: 'User not found.' });
    }
  });
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }
  next();
};

module.exports = { authenticateToken, requireAdmin };
