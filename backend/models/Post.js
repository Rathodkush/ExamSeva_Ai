const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
  title: String,
  content: String,
  author: String,
  authorId: String,
  type: { type: String, default: 'forum' }, // 'forum' or 'announcement'
  isVisible: { type: Boolean, default: true }, // For announcements visibility
  likes: { type: Number, default: 0 },
  likedBy: [String],
  replies: [{
    content: String,
    author: String,
    authorId: String,
    createdAt: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Post', PostSchema);
