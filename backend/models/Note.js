const mongoose = require('mongoose');

const NoteSchema = new mongoose.Schema({
  name: String,
  author: String,
  authorId: String, // To track who uploaded
  role: String,
  subject: String,
  description: String,
  fileName: String,
  filePath: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Note', NoteSchema);
