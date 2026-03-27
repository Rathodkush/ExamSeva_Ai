const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Define directory paths
const dirs = {
  profiles: 'uploads/profiles',
  notes: 'uploads/notes',
  papers: 'uploads/question-papers',
  quizzes: 'uploads/quizzes'
};

// Ensure necessary directories exist
Object.values(dirs).forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let dest = 'uploads/';
    if (file.fieldname === 'profilePicture') {
      dest = dirs.profiles + '/';
    } else if (file.fieldname === 'note' || file.fieldname === 'notes') {
      dest = dirs.notes + '/';
    } else if (file.fieldname === 'paper' || file.fieldname === 'question-paper') {
      dest = dirs.papers + '/';
    } else if (file.fieldname === 'quiz' || file.fieldname === 'file') {
      dest = dirs.quizzes + '/';
    }
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
    cb(null, Date.now() + '-' + safeName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
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

module.exports = { upload, dirs };
