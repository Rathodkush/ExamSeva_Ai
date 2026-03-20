const mongoose = require('mongoose');

const UploadSchema = new mongoose.Schema({
  levelType: String,
  institutionName: String,
  state: String,
  classLevel: String,
  degreeName: String,
  semester: String,
  year: String,
  files: [String],
  fileHashes: [String],
  groups: [mongoose.Schema.Types.Mixed],
  unique: [mongoose.Schema.Types.Mixed],
  metadata: mongoose.Schema.Types.Mixed,
  extractedSections: [mongoose.Schema.Types.Mixed],
  enhancements: [mongoose.Schema.Types.Mixed],
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Upload', UploadSchema);
