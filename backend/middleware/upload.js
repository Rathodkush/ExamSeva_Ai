const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure necessary directories exist
const dirs = ['uploads/profiles', 'uploads/notes', 'uploads/question-papers', 'uploads/quizzes'];
dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let dest = 'uploads/';
    if (file.fieldname === 'profilePicture') {
      dest += 'profiles/';
    } else if (file.fieldname === 'note' || file.fieldname === 'notes') {
      dest += 'notes/';
    } else if (file.fieldname === 'paper' || file.fieldname === 'question-paper') {
      dest += 'question-papers/';
    } else if (file.fieldname === 'quiz' || file.fieldname === 'file') {
      dest += 'quizzes/';
    }
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    // Basic filename sanitization
    const safeName = file.originalname.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
    cb(null, Date.now() + '-' + safeName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.jpg', '.jpeg', '.png', '.docx', '.doc'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${ext} not allowed`));
    }
  }
});

module.exports = upload;
