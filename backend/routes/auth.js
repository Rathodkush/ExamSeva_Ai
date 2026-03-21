const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const Note = require('../models/Note');
const QuizScore = require('../models/QuizScore');
const Post = require('../models/Post');
const { authenticateToken } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.REACT_APP_GOOGLE_CLIENT_ID || '';
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

// Register Route
router.post('/register', async (req, res) => {
  try {
    const {
      fullName, email, phone, password, confirmPassword,
      classStandard, courseType, year
    } = req.body;

    if (!fullName || !email || !phone || !password || !confirmPassword) {
      return res.status(400).json({ error: 'All required fields must be filled' });
    }

    const effectiveRole = 'student';

    if (!classStandard || !courseType || !year) {
      return res.status(400).json({ error: 'Class, Course Type, and Year are required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      return res.status(400).json({ error: 'Phone must be 10 digits' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      fullName,
      email,
      phone: cleanPhone,
      role: effectiveRole,
      password: hashedPassword,
      classStandard,
      courseType,
      year,
      institutionName: req.body.institutionName || '',
      boardName: req.body.boardName || '',
      state: req.body.state || '',
      semester: req.body.semester || ''
    });

    const token = jwt.sign({ userId: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        classStandard: user.classStandard,
        courseType: user.courseType,
        year: user.year
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login Route
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (!user.isActive) {
      return res.status(403).json({ error: 'Account deactivated' });
    }

    const token = jwt.sign({ userId: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    res.json({
      success: true,
      token,
      user: { id: user._id, fullName: user.fullName, email: user.email, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// Google Auth
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!googleClient) return res.status(500).json({ error: 'Google Auth not configured' });

    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    const { email, name, sub } = payload;

    let user = await User.findOne({ email });
    if (!user) {
      const hashedPassword = await bcrypt.hash(require('crypto').randomBytes(16).toString('hex'), 10);
      user = await User.create({ fullName: name, email, role: 'student', password: hashedPassword, googleSub: sub });
    }

    const token = jwt.sign({ userId: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ success: true, token, user });
  } catch (err) {
    res.status(500).json({ error: 'Google auth failed' });
  }
});

// Get Me
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Profile Update
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const updates = req.body;
    delete updates.password;
    delete updates.role;
    const user = await User.findByIdAndUpdate(req.user.userId, updates, { new: true }).select('-password');
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: 'Update failed' });
  }
});

// Statistics
router.get('/statistics', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const papersUploaded = await Note.countDocuments({ authorId: userId });
    const quizzesTaken = await QuizScore.countDocuments({ userId });
    const forumPosts = await Post.countDocuments({ authorId: userId });
    const scores = await QuizScore.find({ userId });
    const averageScore = scores.length ? Math.round(scores.reduce((a, b) => a + b.percentage, 0) / scores.length) : 0;

    res.json({ success: true, statistics: { papersUploaded, quizzesTaken, forumPosts, averageScore } });
  } catch (err) {
    res.status(500).json({ error: 'Stats failed' });
  }
});

module.exports = router;
