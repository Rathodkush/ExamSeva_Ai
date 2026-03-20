const mongoose = require('mongoose');

const QuizSchema = new mongoose.Schema({
  subject: String,
  questions: [{
    question: String,
    options: [String],
    correctAnswer: Number
  }],
  metadata: mongoose.Schema.Types.Mixed, // store original metadata hints
  sourceFile: String,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Quiz', QuizSchema);
