const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Load env explicitly if needed (redundant if already in server.js but safe)
require('dotenv').config();

// Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    let folder = 'examseva/others';
    const originalUrl = req.originalUrl || '';

    if (file.fieldname === 'profilePicture') {
      folder = 'examseva/profiles';
    } else if (file.fieldname === 'noteFile' || originalUrl.includes('/notes')) {
      folder = 'examseva/notes';
    } else if (originalUrl.includes('/quiz')) {
      folder = 'examseva/quizzes';
    } else if (originalUrl.includes('/upload') || originalUrl.includes('/question-papers')) {
      folder = 'examseva/question-papers';
    }

    // Extract file extension and determine resource_type
    const ext = path.extname(file.originalname).toLowerCase();
    const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
    
    return {
      folder: folder,
      public_id: Date.now() + '-' + file.originalname.split('.')[0].replace(/\s+/g, '_'),
      resource_type: isImage ? 'image' : 'raw', // use 'raw' for PDFs to avoid conversion issues, or 'auto'
      format: ext.replace('.', '') // ensure format is preserved
    };
  },
});

const baseUploadsDir = path.join(__dirname, '..', 'uploads');
const dirs = {
  notes: path.join(baseUploadsDir, 'notes'),
  profiles: path.join(baseUploadsDir, 'profiles'),
  papers: path.join(baseUploadsDir, 'question-papers'),
  quizzes: path.join(baseUploadsDir, 'quizzes')
};

// Ensure all subdirectories exist (for local cached files or temporary legacy use)
Object.values(dirs).forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const upload = multer({ storage: storage });

module.exports = { upload, dirs };
