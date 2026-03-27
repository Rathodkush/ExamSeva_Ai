const mongoose = require('mongoose');

const OfficialPaperSchema = new mongoose.Schema({
  title: { type: String, required: true },
  subject: { type: String, required: true },
  classLevel: { type: String },
  examType: { type: String },
  visibility: { type: String, enum: ['free', 'login'], default: 'free' },
  fileName: { type: String, required: true },
  filePath: { type: String, required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('OfficialPaper', OfficialPaperSchema, 'officialquestionpapers');
