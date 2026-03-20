const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const { authenticateToken } = require('../middleware/auth');

// Get all forum posts
router.get('/posts', async (req, res) => {
  try {
    const posts = await Post.find({ type: 'forum' }).sort({ createdAt: -1 });
    res.json({ success: true, posts });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// Create forum post
router.post('/posts', authenticateToken, async (req, res) => {
  try {
    const { title, content, author } = req.body;
    const post = await Post.create({
      title, content, author, authorId: req.user.userId,
      type: 'forum'
    });
    res.json({ success: true, post });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// Like/Unlike post
router.post('/posts/:id/like', authenticateToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    const userId = req.user.userId;
    if (post.likedBy.includes(userId)) {
      post.likedBy = post.likedBy.filter(id => id !== userId);
      post.likes -= 1;
    } else {
      post.likedBy.push(userId);
      post.likes += 1;
    }
    await post.save();
    res.json({ success: true, likes: post.likes });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// Reply to post
router.post('/posts/:id/reply', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    post.replies.push({ content: req.body.content, author: req.body.author, authorId: req.body.authorId });
    await post.save();
    res.json({ success: true, post });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

module.exports = router;
