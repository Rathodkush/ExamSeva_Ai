const mongoose = require('mongoose');

const OfficialPaperSchema = new mongoose.Schema({
  title: { type: String, required: true },
  subject: { type: String, required: true },
  levelType: String,
  institutionName: String,
  state: String,
  classLevel: String,
  degreeName: String, // Added to match Upload model
  semester: String,
  year: String,
  examType: { type: String },
  visibility: { type: String, enum: ['free', 'login'], default: 'free' },
  fileName: { type: String, required: true },
  filePath: { type: String, required: true },
  files: [String], // Array of file paths (original Upload logic)
  fileHashes: [String], // To support analysis cache
  groups: [mongoose.Schema.Types.Mixed], // Extracted AI question groups
  unique: [mongoose.Schema.Types.Mixed], // Unique extracted questions
  metadata: mongoose.Schema.Types.Mixed, // AI detected metadata
  extractedSections: [mongoose.Schema.Types.Mixed], // Direct OCR/AI sections
  enhancements: [mongoose.Schema.Types.Mixed], // AI suggested improvements
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Alias to match Upload model userId
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('OfficialPaper', OfficialPaperSchema, 'officialquestionpapers');
