const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const Post = require('../models/Post');
const Note = require('../models/Note');
const Upload = require('../models/Upload');
const Settings = require('../models/Settings');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const upload = require('../middleware/upload');

// All routes here require admin authentication
router.use(authenticateToken);
router.use(requireAdmin);

// User Management
router.get('/users', async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || user.role === 'admin') return res.status(403).json({ error: 'Cannot delete admin' });
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

router.patch('/users/:id/status', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { isActive: req.body.isActive }, { new: true }).select('-password');
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// Announcements
router.get('/announcements', async (req, res) => {
  try {
    const announcements = await Post.find({ type: 'announcement' }).sort({ createdAt: -1 });
    res.json({ success: true, announcements });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

router.post('/announcements', async (req, res) => {
  try {
    const { title, content, isVisible } = req.body;
    const user = await User.findById(req.user.userId);
    const announcement = await Post.create({
      title, content, author: user.fullName, authorId: req.user.userId,
      type: 'announcement', isVisible: isVisible !== false
    });
    res.json({ success: true, announcement });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

router.delete('/announcements/:id', async (req, res) => {
  try {
    await Post.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// Settings
router.get('/settings', async (req, res) => {
  try {
    const settings = await Settings.findOne();
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

router.put('/settings', async (req, res) => {
  try {
    const settings = await Settings.findOneAndUpdate({}, req.body, { new: true, upsert: true });
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// Dashboard Stats
router.get('/dashboard', async (req, res) => {
  try {
    const statistics = {
      totalUsers: await User.countDocuments(),
      totalPapers: await Upload.countDocuments(),
      totalNotes: await Note.countDocuments(),
      totalAnnouncements: await Post.countDocuments({ type: 'announcement' })
    };
    const recentUsers = await User.find().select('-password').sort({ createdAt: -1 }).limit(5);
    res.json({ success: true, statistics, recentUsers });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

module.exports = router;
