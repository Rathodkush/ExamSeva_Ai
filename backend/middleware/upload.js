const multer = require('multer');
const path = require('path');
const fs = require('fs');

const baseUploadsDir = path.join(__dirname, '..', 'uploads');
const dirs = {
  notes: path.join(baseUploadsDir, 'notes'),
  profiles: path.join(baseUploadsDir, 'profiles'),
  papers: path.join(baseUploadsDir, 'question-papers'),
  quizzes: path.join(baseUploadsDir, 'quizzes')
};

// Ensure all subdirectories exist
Object.values(dirs).forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Determine destination folder based on some parameter or field
    // Fallback based on fieldname if available
    if (file.fieldname === 'profilePicture') {
      return cb(null, dirs.profiles);
    } else if (file.fieldname === 'noteFile' || file.fieldname === 'file' && req.originalUrl.includes('/notes')) {
      return cb(null, dirs.notes);
    } else if (req.originalUrl.includes('/quiz')) {
      return cb(null, dirs.quizzes);
    } else if (req.originalUrl.includes('/upload')) {
      return cb(null, dirs.papers);
    }
    cb(null, baseUploadsDir);
  },
  filename: (req, file, cb) => {
    // Consistent filename generation
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ storage });

module.exports = {
  upload,
  dirs
};

