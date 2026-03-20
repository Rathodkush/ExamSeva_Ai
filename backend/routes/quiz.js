const express = require('express');
const router = express.Router();
const Quiz = require('../models/Quiz');
const QuizScore = require('../models/QuizScore');
const upload = require('../middleware/upload');
const { authenticateToken } = require('../middleware/auth');

// Generate Quiz from PDF/DOC
router.post('/generate', upload.single('file'), async (req, res) => {
  try {
    // In real app, call Python AI to parse PDF into questions
    // This is a placeholder for the refactored route
    res.json({ success: true, message: 'Quiz generation pending AI integration' });
  } catch (err) {
    res.status(500).json({ error: 'Generation failed' });
  }
});

// Save Quiz Score
router.post('/score', authenticateToken, async (req, res) => {
  try {
    const { score, totalQuestions, quizId } = req.body;
    const percentage = Math.round((score / totalQuestions) * 100);
    const quizScore = await QuizScore.create({
      userId: req.user.userId,
      quizId, score, totalQuestions, percentage
    });
    res.json({ success: true, score: quizScore });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

module.exports = router;
