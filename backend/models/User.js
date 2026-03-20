const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String },
  role: { type: String, enum: ['student', 'admin'], default: 'student' },
  password: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  // Optional Student / Bio Fields
  classStandard: String,
  courseType: String,
  year: String,
  institutionName: String,
  boardName: String,
  state: String,
  semester: String,
  bio: { type: String, default: '' },
  avatar: { type: String, default: '' },
  points: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
