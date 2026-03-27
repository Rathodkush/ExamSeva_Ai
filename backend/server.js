const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
// Load environment variables from backend/.env if present
try {
  // eslint-disable-next-line global-require
  require('dotenv').config({ path: path.join(__dirname, '.env') });
} catch (e) {
  // dotenv is optional; if not installed, env vars must come from process environment
}
const axios = require('axios');
const FormData = require('form-data');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { VisitorModel, StatsModel } = require('./models/Stats');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const mammoth = require('mammoth');
const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');

const app = express();
const http = require('http');
const { Server } = require('socket.io');
const cookieParser = require('cookie-parser');
app.use(cors({
  origin: (origin, callback) => {
    // Allow all subdomains of onrender.com and all variants of examseva
    if (!origin || origin.includes('onrender.com') || origin.includes('localhost') || origin.includes('127.0.0.1')) {
      callback(null, true);
    } else {
      callback(null, true); // fallback to true for other origins to be permissive
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));
app.use(express.json());
app.use(cookieParser());
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  next();
});
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Global error handlers to surface crashes during startup
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err && err.stack ? err.stack : err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// MongoDB connection 
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/examsevaDB';
mongoose.connect(MONGODB_URI, {
  autoIndex: true,
  serverSelectionTimeoutMS: 5000
}).then(() => {
  console.log(' MongoDB connected');
}).catch(err => {
  console.error(' MongoDB connection error:', err.message);
  console.log(' App will continue but database features may not work');
});

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
const UploadModel = mongoose.models.Upload || mongoose.model('Upload', UploadSchema);

// Study Notes Schema
const NoteSchema = new mongoose.Schema({
  name: String,
  author: String,
  authorId: String, // To track who uploaded
  role: String,
  subject: String,
  description: String,
  fileName: String, // Legacy single file
  filePath: String, // Legacy single file
  files: [{
    name: String,
    path: String
  }],
  createdAt: { type: Date, default: Date.now }
});
const NoteModel = mongoose.models.Note || mongoose.model('Note', NoteSchema);

// Forum Post Schema
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
const PostModel = mongoose.models.Post || mongoose.model('Post', PostSchema);

// Quiz Schema
const QuizSchema = new mongoose.Schema({
  subject: String,
  questions: [{
    question: String,
    options: [String],
    correctAnswer: Number
  }],
  metadata: mongoose.Schema.Types.Mixed, // store original metadata hints
  sourceFile: String,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});
const QuizModel = mongoose.models.Quiz || mongoose.model('Quiz', QuizSchema);

// Quiz Score Schema - Track user quiz attempts and scores
const QuizScoreSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz' },
  score: { type: Number, required: true },
  totalQuestions: { type: Number, required: true },
  percentage: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});
const QuizScoreModel = mongoose.models.QuizScore || mongoose.model('QuizScore', QuizScoreSchema);

// User Schema
const UserSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: false, default: '' },
  role: { type: String, enum: ['student', 'admin'], default: 'student', required: true },
  // Student fields
  classStandard: { type: String },
  courseType: { type: String },
  year: { type: String },
  // Additional profile fields
  institutionName: { type: String }, // University or Board
  boardName: { type: String },
  state: { type: String },
  semester: { type: String },
  // Common fields
  password: { type: String, required: true },
  googleSub: { type: String },
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  lastLogin: Date,
  lastLogout: Date,
  isEmailVerified: { type: Boolean, default: false },
  isPhoneVerified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  profilePicture: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});
const UserModel = mongoose.models.User || mongoose.model('User', UserSchema);

const ProfileImageSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  imageUrl: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});
const ProfileImageModel = mongoose.models.ProfileImage || mongoose.model('ProfileImage', ProfileImageSchema, 'profileimages');

// OTP Schema
const OTPSchema = new mongoose.Schema({
  emailOrPhone: { type: String, required: true },
  otp: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 900 } // Extended to 15 minutes (900s) to prevent early expiry
});
const OTPModel = mongoose.models.OTP || mongoose.model('OTP', OTPSchema);

const NotificationModel = require('./models/Notification');

// Ensure there is at least one admin user if ADMIN_EMAIL / ADMIN_PASSWORD are provided
const ensureInitialAdmin = async () => {
  try {
    // Allow env override, but fall back to sane defaults so admin always exists in dev
    const adminEmail = process.env.ADMIN_EMAIL || 'examsevahelpdesk@gmail.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'StrongAdminPass123';
    const adminName = process.env.ADMIN_NAME || 'ExamSeva Admin';
    if (!adminEmail || !adminPassword) return;

    const existing = await UserModel.findOne({ email: adminEmail });
    if (existing) {
      // Ensure this user is an active admin and that password matches our configured admin password
      let needsUpdate = false;
      const updates = {};

      if (existing.role !== 'admin') {
        updates.role = 'admin';
        needsUpdate = true;
      }
      if (!existing.isActive) {
        updates.isActive = true;
        needsUpdate = true;
      }

      const passwordMatches = await bcrypt.compare(adminPassword, existing.password);
      if (!passwordMatches) {
        updates.password = await bcrypt.hash(adminPassword, 10);
        needsUpdate = true;
      }

      if (needsUpdate) {
        await UserModel.updateOne({ _id: existing._id }, { $set: updates });
        console.log(' Initial admin user updated:', adminEmail);
      } else {
        console.log(' Initial admin user already exists:', adminEmail);
      }
      return;
    }

    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    const admin = await UserModel.create({
      fullName: adminName,
      email: adminEmail,
      phone: '',
      role: 'admin',
      password: hashedPassword,
      isActive: true
    });
    console.log(' Initial admin user created:', admin.email);
  } catch (e) {
    console.error(' Failed to ensure initial admin user:', e.message || e);
  }
};

// Wait for MongoDB and then ensure admin
mongoose.connection.on('connected', () => {
  ensureInitialAdmin().catch(() => { });
});

// Chat/Messages Schema
const MessageSchema = new mongoose.Schema({
  fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  toUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  forumPostId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
  message: { type: String, required: true },
  isRead: { type: Boolean, default: false },
  type: { type: String, default: 'generic' },
  meta: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now }
});
const MessageModel = mongoose.models.Message || mongoose.model('Message', MessageSchema);

// Website Settings Schema
const SettingsSchema = new mongoose.Schema({
  websiteName: { type: String, default: 'ExamSeva' },
  logoUrl: { type: String, default: '' },
  contactEmail: { type: String, default: 'examsevahelpdesk@gmail.com' },
  contactPhone: { type: String, default: '022-05200' },
  contactAddress: { type: String, default: '123 Education Street, Mumbai City, 400005' },
  aboutUs: { type: String, default: '' },
  footerLinks: [{
    title: String,
    url: String
  }],
  updatedAt: { type: Date, default: Date.now }
});
const SettingsModel = mongoose.models.Settings || mongoose.model('Settings', SettingsSchema);

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.REACT_APP_GOOGLE_CLIENT_ID || '';
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;
// Python AI Service configuration: prefer internal networking on Render if available
const isRender = !!process.env.RENDER;
const pythonBaseUrl = (
  process.env.PYTHON_URL_BASE ||
  process.env.PYTHON_URL ||
  (isRender ? 'http://examseva-ai:5000' : 'http://127.0.0.1:5000') // Use internal hostname on Render for reliability
).replace(/\/$/, '');

console.log(' Python AI service URL:', pythonBaseUrl);

// Nodemailer Config
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Global IO instance for accessibility
let ioInstance = null;

// Helper to create and emit notifications using MessageModel (which is what the UI expects)
const createNotification = async (recipientId, message, type = 'system', senderId = null, meta = {}) => {
  try {
    const notif = await MessageModel.create({
      toUserId: recipientId,
      fromUserId: senderId || '000000000000000000000000', // System user ID placeholder
      message,
      type,
      meta,
      isRead: false
    });
    if (ioInstance) {
      ioInstance.to(recipientId.toString()).emit('new_notification', notif);
    }
    return notif;
  } catch (err) {
    console.error(' Error creating notification:', err);
  }
};

// Helper to notify all users (e.g., when Admin adds Note/Quiz or User adds Forum Post)
const notifyAllUsers = async (message, type = 'announcement', senderId = null, meta = {}, excludeSender = true) => {
  try {
    // Get all active users
    const query = { isActive: true };
    if (excludeSender && senderId && mongoose.Types.ObjectId.isValid(senderId)) {
      query._id = { $ne: senderId };
    }
    
    const users = await UserModel.find(query, '_id');
    const userIds = users.map(u => u._id);
    
    // Create notifications for each user - doing it in bulk for performance
    const notifData = userIds.map(uid => ({
      toUserId: uid,
      fromUserId: senderId || '000000000000000000000000',
      message,
      type,
      meta,
      isRead: false
    }));
    
    if (notifData.length === 0) return;
    
    const createdNotifs = await MessageModel.insertMany(notifData);
    
    // Emit to each user with their unique notification object (including its _id)
    if (ioInstance) {
      createdNotifs.forEach(n => {
        ioInstance.to(n.toUserId.toString()).emit('new_notification', n);
      });
    }
  } catch (err) {
    console.error(' Error notifying all users:', err);
  }
};

// Authentication Middleware
const authenticateToken = (req, res, next) => {
  // Check Authorization header or cookie
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.split(' ')[1]) || req.cookies.token;

  if (!token) {
    return res.status(401).json({ error: 'Access denied: Token required' });
  }

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }

    // Get full user data including role
    try {
      const user = await UserModel.findById(decoded.userId);
      if (!user || !user.isActive) {
        return res.status(403).json({ error: 'User account is inactive or not found.' });
      }
      req.user = {
        userId: decoded.userId,
        email: decoded.email,
        role: user.role
      };
      next();
    } catch (err) {
      return res.status(403).json({ error: 'User not found.' });
    }
  });
};

// Admin Middleware
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }
  next();
};

// (Mentor role removed) - no mentor middleware

// Importing centralized upload middleware
const { upload } = require('./middleware/upload');
const notesUpload = upload; // For backwards compatibility inside server.js if needed
const quizUpload = upload;
const profileUpload = upload;


// Mount the extract-questions route (uses the same multer middleware: quizUpload.single('file'))
const extractRouter = require('./routes_extract_questions');
app.use(extractRouter);

// Convert DOC/DOCX to plain text file (temporary) for Python service if necessary
const convertDocxToTextFile = async (filePath, originalName) => {
  const ext = path.extname(originalName || filePath).toLowerCase();
  if (ext !== '.docx' && ext !== '.doc') return { path: filePath, name: originalName, isTemp: false };
  try {
    const { value: text } = await mammoth.extractRawText({ path: filePath });
    const tmpPath = `${filePath}.txt`;
    await fs.promises.writeFile(tmpPath, text || '', 'utf8');
    return { path: tmpPath, name: (originalName ? originalName.replace(/\.[^/.]+$/, '') : path.basename(filePath)) + '.txt', isTemp: true, tmpPath };
  } catch (err) {
    console.error('Failed to convert docx to text:', err);
    return { path: filePath, name: originalName, isTemp: false };
  }
};

// Health check route
app.get('/api/health', async (req, res) => {
  try {
    // Check Python service health
    let pythonHealth = { status: 'unknown', model_status: 'unknown' };
    try {
      const pythonUrl = `${pythonBaseUrl}/health`;
      const pythonResponse = await axios.get(pythonUrl, { timeout: 5000 });
      pythonHealth = pythonResponse.data || pythonHealth;
      // Normalizing status to 'online' or 'ok'
      if (pythonHealth.status === 'ok') pythonHealth.status = 'online';
    } catch (err) {
      pythonHealth = {
        status: 'unavailable',
        error: err.code === 'ECONNREFUSED' ? 'Python service not running' : err.message
      };
    }

    res.json({
      status: 'ok',
      mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      python_service: pythonHealth,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ==================== OTP VERIFICATION ROUTES ====================

// Send OTP
app.post('/api/auth/send-otp', async (req, res) => {
  try {
    const { email, phone } = req.body;
    console.log(`[OTP] Request received for: Email: ${email}, Phone: ${phone}`);

    if (!email || !phone) {
      console.log('[OTP] Error: Email or Phone missing in request body');
      return res.status(400).json({ error: 'Email and Phone are required' });
    }

    // Check if email already exists
    const existing = await UserModel.findOne({ email });
    if (existing) {
      console.log(`[OTP] Error: Email ${email} is already registered`);
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Generate ONE 6-digit OTP for both (for simplicity and to avoid mismatch)
    const commonOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const emailOtp = commonOtp;
    const phoneOtp = commonOtp;

    // Store in DB
    await OTPModel.deleteMany({ emailOrPhone: { $in: [email, phone] } });
    await OTPModel.create([
      { emailOrPhone: email, otp: emailOtp },
      { emailOrPhone: phone, otp: phoneOtp }
    ]);

    // Send Email
    const mailOptions = {
      from: `"ExamSeva" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'ExamSeva - Email Verification Code',
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #1e3a8a;">Verify your Email</h2>
          <p>Your OTP for ExamSeva registration is:</p>
          <div style="background: #f1f5f9; padding: 15px; font-size: 24px; font-weight: bold; text-align: center; letter-spacing: 5px; color: #1e3a8a;">
            ${emailOtp}
          </div>
          <p style="color: #64748b; font-size: 14px; margin-top: 20px;">This OTP will expire in 10 minutes.</p>
        </div>
      `
    };

    // DON'T AWAIT! Send in background so response is instant for user
    transporter.sendMail(mailOptions).catch(err => {
      console.error('Email send error:', err);
    });

    // [TEST MODE] Return OTPs in response for easy testing on Render
    res.json({
      success: true,
      message: 'OTP sent (Simulated)',
      emailOtp,
      phoneOtp
    });
  } catch (err) {
    console.error('OTP send error:', err);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// Verify OTP
app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const { email, phone, emailOtp, phoneOtp } = req.body;

    // MASTER CODE for testing (allows 123456 to pass for any user)
    const isMasterEmail = emailOtp === '123456';
    const isMasterPhone = phoneOtp === '123456';

    const emailMatch = isMasterEmail || await OTPModel.findOne({ emailOrPhone: email, otp: emailOtp });
    const phoneMatch = isMasterPhone || await OTPModel.findOne({ emailOrPhone: phone, otp: phoneOtp });

    if (!emailMatch || !phoneMatch) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    // Clean up
    await OTPModel.deleteMany({ emailOrPhone: { $in: [email, phone] } });

    res.json({ success: true, message: 'Verified successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Register Route
app.post('/api/auth/register', async (req, res) => {
  try {
    const {
      fullName, email, phone, password, confirmPassword, role,
      // Student fields
      classStandard, courseType, year
    } = req.body;

    // Basic validation
    if (!fullName || !email || !phone || !password || !confirmPassword) {
      return res.status(400).json({ error: 'All required fields must be filled' });
    }

    // Public registration: force role to 'student'
    const effectiveRole = 'student';

    // Student-specific validation
    if (effectiveRole === 'student') {
      if (!classStandard || !courseType || !year) {
        return res.status(400).json({ error: 'Class/Standard, Course Type, and Year are required for students' });
      }
      // Optional but captured fields: institutionName, boardName, state, semester
    }

    // No mentor-specific validation (mentor role removed)

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    // Phone validation - exactly 10 digits
    const phoneRegex = /^\d{10}$/;
    const cleanPhone = phone.replace(/\D/g, ''); // Remove non-digits
    if (!phoneRegex.test(cleanPhone)) {
      return res.status(400).json({ error: 'Phone number must be exactly 10 digits' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Check if user already exists
    const existingUser = await UserModel.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user based on role
    const userData = {
      fullName,
      email,
      phone: cleanPhone,
      role: effectiveRole,
      password: hashedPassword,
      institutionName: req.body.institutionName || req.body.university || req.body.boardName || '',
      boardName: req.body.boardName || '',
      state: req.body.state || '',
      semester: req.body.semester || ''
    };

    if (effectiveRole === 'student') {
      userData.classStandard = classStandard;
      userData.courseType = courseType;
      userData.year = year;
    }

    const user = await UserModel.create(userData);

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1 * 24 * 3600000, // 1 day
      sameSite: 'lax'
    };
    res.cookie('token', token, cookieOptions);

    // Return user data (without password)
    const returnUserData = {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: user.role
    };

    if (role === 'student') {
      returnUserData.classStandard = user.classStandard;
      returnUserData.courseType = user.courseType;
      returnUserData.year = user.year;
    }

    console.log('User registered:', user.email, 'Role:', user.role);

    // Add the new fields to returned user data
    if (user.institutionName) returnUserData.institutionName = user.institutionName;
    if (user.boardName) returnUserData.boardName = user.boardName;
    if (user.state) returnUserData.state = user.state;
    if (user.semester) returnUserData.semester = user.semester;

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      token,
      user: returnUserData
    });
  } catch (err) {
    console.error(' Registration error:', err);
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: 'Failed to create account', detail: err.message });
  }
});

// Forgot Password
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await UserModel.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Generate token
    const token = crypto.randomBytes(20).toString('hex');
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // Send reset email
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/forgot-password?token=${token}`;
    const mailOptions = {
      from: `"ExamSeva Support" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'ExamSeva - Password Reset Request',
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #1e3a8a;">Reset your Password</h2>
          <p>You requested a password reset. Please click the button below to set a new password:</p>
          <a href="${resetUrl}" style="display: inline-block; background: #1e3a8a; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; margin: 20px 0;">Reset Password</a>
          <p>Or use this token if requested: <strong>${token}</strong></p>
          <p style="color: #64748b; font-size: 14px;">This link will expire in 1 hour.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: 'Reset email sent!', resetToken: token });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send reset email' });
  }
});

// Reset Password
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const user = await UserModel.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) return res.status(400).json({ error: 'Invalid or expired token' });

    // Update password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    // Send success email
    const mailOptions = {
      from: `"ExamSeva Support" <${process.env.SMTP_USER}>`,
      to: user.email,
      subject: 'ExamSeva - Password Reset Successful',
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #10b981;">Password Reset Successful</h2>
          <p>Hello ${user.fullName},</p>
          <p>Your password for ExamSeva has been successfully reset. If you did not perform this action, please contact support immediately.</p>
          <p style="color: #64748b; font-size: 14px; margin-top: 20px;">Safe learning!</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions).catch(err => console.error('Success email error:', err));

    res.json({ success: true, message: 'Password reset successful!' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Login Route
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = await UserModel.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({ error: 'Your account has been deactivated. Please contact admin.' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Return user data (without password)
    const userData = {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: user.role
    };

    // Add role-specific fields
    if (user.role === 'student') {
      userData.classStandard = user.classStandard;
      userData.courseType = user.courseType;
      userData.year = user.year;
    }

    console.log(' User logged in:', user.email, 'Role:', user.role);
    // Cookie options
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1 * 24 * 3600000, // 1 day
      sameSite: 'lax'
    };

    res.cookie('token', token, cookieOptions);

    // Track Login Time
    await user.updateOne({ lastLogin: new Date() });

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: userData
    });

    // Increment Login Stat
    await StatsModel.findOneAndUpdate({ key: 'total_logins' }, { $inc: { value: 1 } }, { upsert: true });

    // Send Welcome Back Notification (only if not sent in last 12 hours)
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
    const existingNotif = await MessageModel.findOne({
      toUserId: user._id,
      type: 'login',
      createdAt: { $gt: twelveHoursAgo }
    });
    if (!existingNotif) {
      createNotification(user._id, `Welcome back, ${user.fullName.split(' ')[0]}!`, 'login');
    }

  } catch (err) {
    console.error(' Login error:', err);
    res.status(500).json({ error: 'Login failed', detail: err.message });
  }
});

// Google Auth (Signup/Login) Route
app.post('/api/auth/google', async (req, res) => {
  try {
    const { credential } = req.body || {};
    if (!credential) {
      return res.status(400).json({ error: 'Google credential is required' });
    }
    if (!googleClient) {
      return res.status(500).json({ error: 'Google auth not configured', detail: 'Set GOOGLE_CLIENT_ID on the backend (and REACT_APP_GOOGLE_CLIENT_ID on the frontend).' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload() || {};
    const email = payload.email;
    const fullName = payload.name || payload.given_name || 'User';
    const googleSub = payload.sub;

    if (!email) return res.status(400).json({ error: 'Google account email not available' });

    let user = await UserModel.findOne({ email });
    if (!user) {
      // Create a student account. Phone is optional for Google users; user can add it in Profile.
      const crypto = require('crypto');
      const tempPass = crypto.randomBytes(16).toString('hex');
      const hashedPassword = await bcrypt.hash(tempPass, 10);
      user = await UserModel.create({
        fullName,
        email,
        phone: '', // optional now (see schema update below)
        role: 'student',
        password: hashedPassword,
        googleSub
      });
      // New Google User Welcome
      createNotification(user._id, `Welcome to ExamSeva! You've successfully signed up via Google.`, 'welcome');
    } else {
      // Update name if missing
      if (!user.fullName && fullName) user.fullName = fullName;
      if (!user.googleSub && googleSub) user.googleSub = googleSub;
      await user.save().catch(() => { });
      // Returning Google User Welcome Back (only if not sent in last 12 hours)
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
      const existingNotif = await MessageModel.findOne({
        toUserId: user._id,
        type: 'login',
        createdAt: { $gt: twelveHoursAgo }
      });
      if (!existingNotif) {
        createNotification(user._id, `Welcome back, ${user.fullName.split(' ')[0]}! logged in via Google.`, 'login');
      }
    }

    if (!user.isActive) return res.status(403).json({ error: 'Your account has been deactivated. Please contact admin.' });

    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1 * 24 * 3600000,
      sameSite: 'lax'
    };
    res.cookie('token', token, cookieOptions);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone || '',
        role: user.role,
        classStandard: user.classStandard,
        courseType: user.courseType,
        year: user.year,
        institutionName: user.institutionName,
        boardName: user.boardName,
        state: user.state,
        semester: user.semester
      }
    });

    // Track Login Time
    await user.updateOne({ lastLogin: new Date() });
  } catch (err) {
    console.error('Google auth error:', err);
    res.status(500).json({ error: 'Google authentication failed', detail: err.message });
  }
});

// Logout Route (to track session end)
app.post('/api/auth/logout', authenticateToken, async (req, res) => {
  try {
    await UserModel.findByIdAndUpdate(req.user.userId, { lastLogout: new Date() });
    res.clearCookie('token');
    res.json({ success: true, message: 'Logout tracked' });
  } catch (e) {
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Get User Statistics (Protected)
app.get('/api/user/statistics', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Count papers uploaded by this user
    const papersUploaded = await NoteModel.countDocuments({ authorId: userId });

    // Count quizzes taken by this user
    const quizzesTaken = await QuizScoreModel.countDocuments({ userId });

    // Count forum posts created by this user
    const forumPosts = await PostModel.countDocuments({ authorId: userId });

    // Calculate average score across all quizzes taken by this user
    const scores = await QuizScoreModel.find({ userId });
    let averageScore = 0;
    if (scores.length > 0) {
      const totalPercentage = scores.reduce((acc, curr) => acc + (curr.percentage || 0), 0);
      averageScore = Math.round(totalPercentage / scores.length);
    }

    res.json({
      success: true,
      statistics: {
        papersUploaded,
        quizzesTaken,
        forumPosts,
        averageScore
      }
    });
  } catch (err) {
    console.error('Error fetching user statistics:', err);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Get Current User (Protected)
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await UserModel.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
  } catch (err) {
    console.error(' Error fetching user:', err);
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

// Update profile (authenticated)
app.put('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const updates = {};
    const allowed = ['fullName', 'phone', 'classStandard', 'courseType', 'year', 'institutionName', 'boardName', 'state', 'semester', 'profilePicture'];
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    // Validate phone if provided
    if (updates.phone) {
      const cleanPhone = updates.phone.replace(/\D/g, '');
      if (!/^\d{10}$/.test(cleanPhone)) {
        return res.status(400).json({ error: 'Phone number must be exactly 10 digits' });
      }
      // Check uniqueness
      const existing = await UserModel.findOne({ phone: cleanPhone, _id: { $ne: req.user.userId } });
      if (existing) {
        return res.status(400).json({ error: 'Phone number already in use' });
      }
      updates.phone = cleanPhone;
    }

    const user = await UserModel.findByIdAndUpdate(req.user.userId, { $set: updates }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({ success: true, user });
  } catch (err) {
    console.error(' Error updating profile:', err);
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Duplicate value exists', detail: err.message });
    }
    res.status(500).json({ error: 'Failed to update profile', detail: err.message });
  }
});

// Using centralized upload middleware instead


app.post('/api/auth/profile-picture', authenticateToken, profileUpload.single('profilePicture'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const profilePictureUrl = `uploads/profiles/${req.file.filename}`;
    
    // Save to the new dedicated images collection
    await ProfileImageModel.create({
      userId: req.user.userId,
      imageUrl: profilePictureUrl
    });

    // Also update the User model for fast access
    await UserModel.findByIdAndUpdate(req.user.userId, { profilePicture: profilePictureUrl });
    
    res.json({ success: true, profilePicture: profilePictureUrl });
  } catch (err) {
    console.error('Profile picture upload error:', err);
    res.status(500).json({ error: 'Failed to upload profile picture' });
  }
});

// Forgot Password Route
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await UserModel.findOne({ email });
    if (!user) {
      // Don't reveal if user exists or not for security
      return res.json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.'
      });
    }

    // Generate reset token
    const resetToken = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1h' });
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // In production, send email with reset link
    // For now, we'll return the token (in production, send via email)
    console.log(' Password reset token generated for:', user.email);
    console.log(' Reset token (for development):', resetToken);

    // TODO: Configure nodemailer to send actual email
    // For now, return success message
    res.json({
      success: true,
      message: 'Password reset instructions have been sent to your email.',
      // In development, include token (remove in production)
      resetToken: process.env.NODE_ENV === 'development' ? resetToken : undefined
    });
  } catch (err) {
    console.error(' Forgot password error:', err);
    res.status(500).json({ error: 'Failed to process request', detail: err.message });
  }
});

// Reset Password Route
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;

    if (!token || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const user = await UserModel.findOne({
      _id: decoded.userId,
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password and clear reset token
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    console.log(' Password reset successful for:', user.email);
    res.json({ success: true, message: 'Password has been reset successfully' });
  } catch (err) {
    console.error(' Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password', detail: err.message });
  }
});

// Cookie Logout Route
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true, message: 'Logged out successfully' });
});
// Diagnostic check for upload route registration
app.get('/api/upload', (req, res) => {
  res.json({ status: 'ok', msg: 'POST version exists next' });
});

app.post('/api/upload', upload.array('files'), async (req, res) => {
  const startTime = Date.now();
  try {
    const files = req.files || [];

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded', groups: [], unique: [] });
    }

    let metadata = {};
    // Prefer unified JSON metadata if provided by frontend
    if (req.body.metadata) {
      try {
        metadata = JSON.parse(req.body.metadata);
      } catch (e) {
        console.error('Error parsing metadata:', e);
        metadata = {};
      }
    } else {
      metadata = {
        levelType: req.body.levelType || '',
        institutionName: req.body.institutionName || '',
        state: req.body.state || '',
        classLevel: req.body.classLevel || '',
        degreeName: req.body.degreeName || '',
        semester: req.body.semester || '',
        year: req.body.year || ''
      };
    }

    // If user is authenticated, prefer profile metadata from their account.
    const profileAuthHeader = req.headers['authorization'];
    if (profileAuthHeader) {
      const token = profileAuthHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const profileUser = await UserModel.findById(decoded.userId).lean();
        if (profileUser) {
          // Merge profile fields if available; do not overwrite frontend-specified values unless empty
          // NOTE: subject/year should be detected from paper; profile provides institution/class/course defaults.
          metadata.university = metadata.university || metadata.institutionName || profileUser.institutionName || profileUser.boardName || '';
          metadata.classStandard = metadata.classStandard || profileUser.classStandard || '';
          metadata.courseType = metadata.courseType || profileUser.courseType || '';
          metadata.semester = metadata.semester || profileUser.semester || '';
          metadata.year = metadata.year || profileUser.year || '';
          metadata.academicYear = metadata.academicYear || metadata.year || profileUser.year || '';
        }
      } catch (e) {
        // Ignore token errors and proceed with provided metadata
      }
    }

    console.log(` Processing ${files.length} file(s) for analysis...`);

    // Compute SHA256 hash for each uploaded file to support deduplication/cache
    const crypto = require('crypto');
    const fileHashes = [];
    for (const f of files) {
      try {
        const data = fs.readFileSync(f.path);
        const h = crypto.createHash('sha256').update(data).digest('hex');
        fileHashes.push(h);
      } catch (e) {
        console.warn('Failed to compute hash for file', f.path, e.message || e);
      }
    }

    // Check for existing upload with the same file hash and return cached analysis if found
    if (fileHashes.length > 0) {
      const cached = await UploadModel.findOne({ fileHashes: { $in: fileHashes } }).sort({ createdAt: -1 }).lean();
      if (cached) {
        console.log(' Found previous analysis record for uploaded file(s)');
        // If the caller requested fastMode but cached record doesn't have extractedSections,
        // bypass cache so we can reprocess and return structured output.
        const requestedFastMode = !!(metadata && metadata.fastMode);
        const cachedHasSections = Array.isArray(cached.extractedSections) && cached.extractedSections.length > 0;
        if (!(requestedFastMode && !cachedHasSections)) {
          // Clean up uploaded files
          files.forEach(f => fs.unlink(f.path, () => { }));

          if (cached.groups && cached.groups.length > 0 || cached.unique && cached.unique.length > 0 || cachedHasSections) {
            return res.json({
              groups: cached.groups || [],
              unique: cached.unique || [],
              extractedSections: cached.extractedSections || [],
              metadata: cached.metadata || null,
              cached: true,
              cachedAt: cached.createdAt,
              filesProcessed: files.length
            });
          } else {
            // Previously processed but yielded no readable text - return helpful message
            return res.status(400).json({
              error: 'Previous analysis found no readable text in these files',
              detail: 'This file was processed earlier and OCR could not extract readable text. Try higher-quality scans, converting to PDF, or reducing page range.',
              cached: true,
              cachedAt: cached.createdAt
            });
          }
        } else {
          console.log(' Cached record missing extractedSections; reprocessing due to fastMode request');
        }
      }
    }

    const form = new FormData();
    files.forEach(f => {
      form.append('files', fs.createReadStream(f.path), f.originalname);
    });
    // Send full metadata for analysis. (fastMetadata is only for /api/upload/preview)
    form.append('metadata', JSON.stringify(Object.assign({}, metadata)));

    let response;
    let analysisData = { groups: [], unique: [] };

    try {
      // Set timeout to 3 minutes for heavy jobs
      const pythonProcessUrl = `${pythonBaseUrl}/process`;
      response = await axios.post(pythonProcessUrl, form, {
        headers: form.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 300000 // 5 minutes (300k ms)
      });

      // Ensure response has the expected structure
      if (response && response.data) {
        analysisData = {
          groups: Array.isArray(response.data.groups) ? response.data.groups : [],
          unique: Array.isArray(response.data.unique) ? response.data.unique : []
        };
        console.log(` Analysis completed: ${analysisData.groups.length} groups, ${analysisData.unique.length} unique questions`);
      } else {
        console.warn(' Python service returned unexpected response structure');
        analysisData = { groups: [], unique: [] };
      }
    } catch (axiosErr) {
      console.error(' Python AI service error:', axiosErr.message);

      // If Python service is not available, return empty results with helpful message
      if (axiosErr.code === 'ECONNREFUSED' || axiosErr.code === 'ETIMEDOUT' || axiosErr.code === 'ENOTFOUND') {
        console.log(`⚠️ Python service unavailable at ${pythonBaseUrl}`);
        return res.status(503).json({
          error: 'Analysis service unavailable',
          detail: 'The Python AI analysis service is not running. Please ensure the Python service is started on port 5000.',
          groups: [],
          unique: [],
          serviceError: true
        });
      }

      // For other errors, try to extract error details
      if (axiosErr.response && axiosErr.response.data) {
        analysisData = {
          groups: Array.isArray(axiosErr.response.data.groups) ? axiosErr.response.data.groups : [],
          unique: Array.isArray(axiosErr.response.data.unique) ? axiosErr.response.data.unique : []
        };
      }

      // If we still don't have data, throw the error
      if (analysisData.groups.length === 0 && analysisData.unique.length === 0) {
        throw axiosErr;
      }
    }

    const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(` Processing completed in ${processingTime}s`);

    // Get userId from token if authenticated
    let userId = null;
    const authHeader = req.headers['authorization'];
    if (authHeader) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        userId = decoded.userId;
      } catch (err) {


      }
    }

    // Persist to MongoDB asynchronously (don't block response)
    const saveToDB = async () => {
      try {
        const savedDoc = await UploadModel.create({
          levelType: metadata.levelType || '',
          institutionName: metadata.institutionName || '',
          state: metadata.state || '',
          classLevel: metadata.classLevel || '',
          degreeName: metadata.degreeName || '',
          semester: metadata.semester || '',
          year: metadata.year || '',
          // Storing relative paths for access (e.g. uploads/question-papers/...)
          files: files.map(f => `uploads/question-papers/${f.filename}`),
          fileHashes: fileHashes,
          groups: analysisData.groups || [],
          unique: analysisData.unique || [],
          metadata: (response && response.data && response.data.metadata) ? response.data.metadata : null,
          extractedSections: (response && response.data && Array.isArray(response.data.extractedSections)) ? response.data.extractedSections : [],
          userId: userId
        });
        console.log(' Data saved to MongoDB (with real files):', savedDoc._id);
      } catch (e) {
        console.error(' Mongo save error:', e.message);
      }
    };
    // Don't await - save in background
    saveToDB().catch(() => { });

    // REAL FILES ARE NOW SAVED (Cleanup removed as per user request)


    // Return response with guaranteed structure
    const responseData = {
      groups: analysisData.groups || [],
      unique: analysisData.unique || [],
      extractedSections: (response && response.data && Array.isArray(response.data.extractedSections)) ? response.data.extractedSections : [],
      fastMode: (response && response.data && response.data.fastMode) ? true : false,
      metadata: (response && response.data && response.data.metadata) ? response.data.metadata : (req.body.metadata ? (() => { try { return JSON.parse(req.body.metadata); } catch (e) { return null; } })() : null),
      saved: true,
      totalTime: processingTime,
      filesProcessed: files.length
    };

    // Include any additional data from Python service if available
    if (response && response.data) {
      Object.keys(response.data).forEach(key => {
        if (key !== 'groups' && key !== 'unique') {
          responseData[key] = response.data[key];
        }
      });
    }

    console.log(` Returning analysis results: ${responseData.groups.length} groups, ${responseData.unique.length} unique. Files saved in question-papers.`);

    res.json(responseData);

  } catch (err) {
    const errorTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(` Upload error after ${errorTime}s:`, err.message || err);

    // Cleanup files on error
    if (req.files) {
      req.files.forEach(f => {
        if (f && f.path) {
          fs.unlink(f.path, () => { });
        }
      });
    }

    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
      res.status(504).json({
        error: 'Processing timeout',
        detail: 'Analysis took too long. Please try with smaller files or fewer pages.',
        groups: [],
        unique: []
      });
    } else if (err.response && err.response.status) {
      // Map python 400 -> more actionable message
      if (err.response.status === 400) {
        res.status(400).json({
          error: 'Analysis failed: no readable text found',
          detail: 'OCR could not extract text from the uploaded files. Try: 1) Use higher-quality scans (300dpi+), 2) Upload a PDF instead of images, 3) Ensure text is printed (not handwritten), 4) Try a smaller page range or single file for analysis.',
          groups: [],
          unique: []
        });
      } else {
        res.status(err.response.status).json({
          error: 'Analysis service error',
          detail: err.response.data?.detail || err.response.data?.error || err.message,
          groups: [],
          unique: []
        });
      }
    } else {
      res.status(500).json({
        error: 'Server error',
        detail: err.message || 'An unexpected error occurred',
        groups: [],
        unique: []
      });
    }
  }
});

// Route to get all saved uploads (optionally filtered by user)
app.get('/api/uploads', async (req, res) => {
  try {
    let query = {};

    // If user is authenticated, try to get their uploads
    const authHeader = req.headers['authorization'];
    if (authHeader) {
      try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        // Filter by userId if available
        query.userId = decoded.userId;
      } catch (e) {
        // If token is invalid, show all uploads
      }
    }

    const uploads = await UploadModel.find(query).sort({ createdAt: -1 }).limit(50);
    res.json({ count: uploads.length, uploads });
  } catch (err) {
    console.error('Error fetching uploads:', err);
    res.status(500).json({ error: 'Failed to fetch uploads' });
  }
});

// Re-analyze existing upload with force OCR
app.post('/api/uploads/:uploadId/reanalyze', authenticateToken, async (req, res) => {
  try {
    const { uploadId } = req.params;
    const { forceOcr } = req.body;

    const upload = await UploadModel.findById(uploadId);
    if (!upload) {
      return res.status(404).json({ error: 'Upload not found' });
    }

    if (!upload.files || upload.files.length === 0) {
      return res.status(400).json({ error: 'No files found for this upload' });
    }

    // Read files from disk
    const form = new FormData();
    for (const filePath of upload.files) {
      try {
        if (fs.existsSync(filePath)) {
          form.append('files', fs.createReadStream(filePath), path.basename(filePath));
        }
      } catch (fileErr) {
        console.warn('Failed to read file:', filePath, fileErr);
      }
    }

    if (form.getAll('files').length === 0) {
      return res.status(400).json({ error: 'No valid files found to re-analyze' });
    }

    // Prepare metadata with forceOcr
    const metadata = {
      levelType: upload.levelType,
      institutionName: upload.institutionName,
      classLevel: upload.classLevel,
      year: upload.year,
      forceOcr: forceOcr !== false // Default to true for re-analysis
    };
    form.append('metadata', JSON.stringify(metadata));

    // Send to Python service for processing
    const pythonUrl = `${pythonBaseUrl}/process`;
    const response = await axios.post(pythonUrl, form, {
      headers: form.getHeaders(),
      timeout: 300000 // 5 minutes
    });

    const data = response.data || {};
    const groups = Array.isArray(data.groups) ? data.groups : [];
    const unique = Array.isArray(data.unique) ? data.unique : [];

    // Update upload record with new analysis
    upload.groups = groups;
    upload.unique = unique;
    if (data.metadata) {
      upload.levelType = data.metadata.course || upload.levelType;
      upload.institutionName = data.metadata.university || upload.institutionName;
    }
    await upload.save();

    res.json({
      success: true,
      groups: groups,
      unique: unique,
      metadata: data.metadata || null
    });
  } catch (err) {
    console.error('Error re-analyzing upload:', err);
    res.status(500).json({ error: 'Failed to re-analyze upload', detail: err.message });
  }
});

// Lightweight preview endpoint - extract metadata quickly without saving Upload record
app.post('/api/upload/preview', upload.array('files'), async (req, res) => {
  try {
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ error: 'No files uploaded' });

    // Compute file hashes for dedupe
    const crypto = require('crypto');
    const fileHashes = [];
    for (const f of files) {
      try {
        const data = fs.readFileSync(f.path);
        const h = crypto.createHash('sha256').update(data).digest('hex');
        fileHashes.push(h);
      } catch (e) {
        console.warn('Failed to compute hash for file', f.path, e.message || e);
      }
    }

    // If we found a previous record, return its metadata if available
    if (fileHashes.length > 0) {
      const cached = await UploadModel.findOne({ fileHashes: { $in: fileHashes } }).sort({ createdAt: -1 }).lean();
      if (cached) {
        // Clean up uploaded temp files
        files.forEach(f => fs.unlink(f.path, () => { }));
        if (cached.metadata || (cached.groups && cached.groups.length > 0) || (cached.unique && cached.unique.length > 0)) {
          return res.json({ cached: true, metadata: cached.metadata || null, groups: cached.groups || [], unique: cached.unique || [] });
        } else {
          return res.status(400).json({ cached: true, error: 'Previous analysis found no readable text in these files' });
        }
      }
    }

    // Call Python service with fastMetadata flag
    const form = new FormData();
    files.forEach(f => form.append('files', fs.createReadStream(f.path), f.originalname));
    const metadataHint = Object.assign({}, req.body.metadata ? JSON.parse(req.body.metadata) : {}, { fastMetadata: true });
    form.append('metadata', JSON.stringify(metadataHint));

    let response;
    try {
      const pythonProcessUrl = `${pythonBaseUrl}/process`;
      response = await axios.post(pythonProcessUrl, form, {
        headers: form.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 300000 // Increased to 5m for preview on Render
      });
    } catch (err) {
      // Cleanup files
      files.forEach(f => fs.unlink(f.path, () => { }));

      // Handle different error types
      if (err.response) {
        const status = err.response.status;
        const errorData = err.response.data || {};

        if (status === 400) {
          // Python service returned 400 - likely no text extracted
          return res.status(400).json({
            error: errorData.error || 'Preview analysis failed: no readable text found',
            detail: errorData.detail || 'OCR could not extract text from the uploaded files',
            groups: [],
            unique: []
          });
        } else if (status === 500) {
          // Python service internal error - might be model loading issue
          return res.status(503).json({
            error: 'Python service error',
            detail: errorData.detail || errorData.error || 'Model processing failed. Please check Python service logs.',
            groups: [],
            unique: []
          });
        } else {
          return res.status(status).json({
            error: errorData.error || 'Preview failed',
            detail: errorData.detail || err.message,
            groups: [],
            unique: []
          });
        }
      } else if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
        // Python service not running or not reachable
        return res.status(503).json({
          error: 'Python service unavailable',
          detail: 'The Python AI service is not running. Please ensure the Python service is started on port 5000.',
          groups: [],
          unique: []
        });
      } else {
        console.error('Preview Python service error:', err.message || err);
        return res.status(503).json({
          error: 'Preview service unavailable',
          detail: err.message || 'Unknown error occurred',
          groups: [],
          unique: []
        });
      }
    }

    // Cleanup uploaded temp files
    files.forEach(f => fs.unlink(f.path, () => { }));

    const data = response.data || {};
    // Attach cached=true if the service returned no groups but had metadata
    return res.json({ metadata: data.metadata || null, groups: data.groups || [], unique: data.unique || [] });

  } catch (e) {
    console.error('Preview endpoint error:', e);
    // Cleanup any uploaded files
    if (req.files) req.files.forEach(f => fs.unlink(f.path, () => { }));
    res.status(500).json({ error: 'Preview failed', detail: e.message || e });
  }
});

// Enhancement endpoint: attempt to enhance images/pdf pages and re-run OCR
app.post('/api/upload/enhance', upload.array('files'), async (req, res) => {
  try {
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ error: 'No files uploaded' });

    const form = new FormData();
    files.forEach(f => form.append('files', fs.createReadStream(f.path), f.originalname));

    let response;
    try {
      const pythonUrl = `${pythonBaseUrl}/enhance_and_process`;
      response = await axios.post(pythonUrl, form, {
        headers: form.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 300000 // 5 minutes for enhancement
      });
    } catch (err) {
      files.forEach(f => fs.unlink(f.path, () => { }));
      if (err.response && err.response.status === 400) {
        return res.status(400).json({ error: 'Enhancement attempted but no readable text found' });
      }
      console.error('Enhancement Python service error:', err.message || err);
      return res.status(503).json({ error: 'Enhancement service unavailable' });
    }

    // Cleanup uploaded temp files
    files.forEach(f => fs.unlink(f.path, () => { }));

    const data = response.data || {};

    // If caller passed a 'save' flag in the body, record the attempt in DB
    try {
      if (req.body && req.body.save && (data.groups || data.unique)) {
        const metadata = req.body.metadata ? JSON.parse(req.body.metadata) : {};
        const names = files.map(f => f.originalname);
        const hashes = [];
        const crypto = require('crypto');
        // Compute hashes before cleaning up temp files
        for (const f of files) {
          try {
            const d = fs.readFileSync(f.path);
            const h = crypto.createHash('sha256').update(d).digest('hex');
            hashes.push(h);
          } catch (e) {
            hashes.push(null);
          }
        }
        const uploadRecord = await UploadModel.create({
          levelType: metadata.levelType || '',
          institutionName: metadata.institutionName || '',
          state: metadata.state || '',
          classLevel: metadata.classLevel || '',
          degreeName: metadata.degreeName || '',
          semester: metadata.semester || '',
          year: metadata.year || '',
          files: names,
          fileHashes: hashes,
          groups: data.groups || [],
          unique: data.unique || [],
          enhancements: data.enhancedPages || [],
          createdAt: new Date()
        });
        // Attach record id for client reference
        data.recordId = uploadRecord._id;
      }
    } catch (dbErr) {
      console.warn('Failed to save enhancement record:', dbErr.message || dbErr);
    }

    // Cleanup uploaded temp files
    files.forEach(f => fs.unlink(f.path, () => { }));

    return res.json(data);

  } catch (e) {
    console.error('Enhance endpoint error:', e);
    if (req.files) req.files.forEach(f => fs.unlink(f.path, () => { }));
    res.status(500).json({ error: 'Enhancement failed', detail: e.message || e });
  }
});

app.get('/api/uploads/:id/download', async (req, res) => {
  try {
    const upload = await UploadModel.findById(req.params.id);
    if (!upload || !upload.files || upload.files.length === 0) {
      return res.status(404).json({ error: 'No files found for this upload' });
    }
    
    // Download first file by default
    const storedPath = upload.files[0];
    const fileName = path.basename(storedPath);
    const localPath = path.join(uploadsDir, fileName);
    const resolvedPath = fs.existsSync(localPath) ? localPath : storedPath;
    
    if (fs.existsSync(resolvedPath)) {
      res.download(resolvedPath, fileName);
    } else {
      res.status(404).json({ error: 'File missing on server' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Download failed' });
  }
});

app.get('/api/uploads/:id/files/:fileIndex/view', async (req, res) => {
  try {
    const upload = await UploadModel.findById(req.params.id);
    if (!upload || !upload.files || !upload.files[req.params.fileIndex]) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const storedPath = upload.files[req.params.fileIndex];
    const fileName = path.basename(storedPath);
    const localPath = path.join(uploadsDir, fileName);
    const resolvedPath = fs.existsSync(localPath) ? localPath : storedPath;
    
    if (!fs.existsSync(resolvedPath)) return res.status(404).json({ error: 'File missing' });
    
    // Set content type based on extension
    const ext = path.extname(resolvedPath).toLowerCase();
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.txt': 'text/plain'
    };
    
    res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
    res.sendFile(filePath);
  } catch (err) {
    res.status(500).json({ error: 'View failed' });
  }
});

// Study Notes Routes
app.post('/api/notes', notesUpload.array('files', 15), async (req, res) => {
  try {
    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database not connected. Please ensure MongoDB is running.' });
    }

    const { name, author, authorId, role, subject, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const uploadedFiles = (req.files || []).map(f => ({
      name: f.originalname,
      path: f.path
    }));

    if (uploadedFiles.length === 0) {
      return res.status(400).json({ error: 'At least one file is required' });
    }

    const note = await NoteModel.create({
      name,
      author: author || name,
      authorId: authorId || 'user-' + Date.now(),
      role: role || 'student',
      subject: subject || 'General',
      description: description || '',
      files: uploadedFiles,
      // For backward compatibility with older components (removed fileName/filePath as it's now multi-file)
    });
    console.log(' Note saved with', uploadedFiles.length, 'files:', note._id);

    // Notify all users about new study material
    notifyAllUsers(
      `${author || 'A student'} shared a new study material: "${name}" for ${subject}.`,
      'study_hub',
      authorId,
      { noteId: note._id, subject }
    );

    // Send files to Python OCR/NLP service for metadata extraction and QA indexing
    (async () => {
      try {
        const form = new FormData();
        req.files.forEach(f => {
          form.append('files', fs.createReadStream(f.path), f.originalname);
        });
        form.append('metadata', JSON.stringify({ uploadedBy: author || name }));

        const pythonUrl = `${pythonBaseUrl}/process`;
        const resp = await axios.post(pythonUrl, form, {
          headers: form.getHeaders(),
          timeout: 300000
        });
        const data = resp.data || {};

        // Persist an Upload record with extracted groups, unique questions and metadata
        try {
          await UploadModel.create({
            levelType: data.metadata?.course || data.metadata?.subject || null,
            institutionName: data.metadata?.university || null,
            classLevel: data.metadata?.course || null,
            year: null,
            files: req.files.map(f => f.path),
            groups: data.groups || [],
            unique: data.unique || [],
            createdAt: new Date()
          });

          // Update Note with detected subject/paper details if present
          const update = {};
          if (data.metadata && data.metadata.subject) update.subject = data.metadata.subject;
          if (data.metadata && data.metadata.paper_details) update.description = (note.description || '') + '\n\n[Auto] ' + data.metadata.paper_details;
          if (Object.keys(update).length > 0) {
            await NoteModel.findByIdAndUpdate(note._id, update);
          }

          console.log(' Python processing completed for files:', req.files.length);
        } catch (saveErr) {
          console.error('Failed to save upload metadata:', saveErr.message || saveErr);
        }
      } catch (pyErr) {
        console.error('Python service processing failed:', pyErr.message || pyErr);
      }
    })();

    res.json({ success: true, note });
  } catch (err) {
    console.error(' Error saving note:', err);
    // Cleanup file if save failed
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlink(req.file.path, () => { });
    }
    res.status(500).json({ error: 'Failed to save note', detail: err.message });
  }
});

// --- NOTIFICATION ROUTES ---

// Get all notifications for current user
app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const notifications = await NotificationModel.find({ recipient: req.user.userId })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ success: true, notifications });
  } catch (err) {
    console.error(' Error fetching notifications:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark notification as read
app.patch('/api/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    const notification = await NotificationModel.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user.userId },
      { $set: { isRead: true } },
      { new: true }
    );
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    res.json({ success: true, notification });
  } catch (err) {
    console.error(' Error updating notification:', err);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// Mark all as read
app.post('/api/notifications/mark-all-read', authenticateToken, async (req, res) => {
  try {
    await NotificationModel.updateMany(
      { recipient: req.user.userId, isRead: false },
      { $set: { isRead: true } }
    );
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    console.error(' Error marking notifications as read:', err);
    res.status(500).json({ error: 'Failed to update notifications' });
  }
});

// Delete specific notification
app.delete('/api/notifications/:id', authenticateToken, async (req, res) => {
  try {
    const notification = await NotificationModel.findOneAndDelete({
      _id: req.params.id,
      recipient: req.user.userId
    });
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    res.json({ success: true, message: 'Notification deleted' });
  } catch (err) {
    console.error(' Error deleting notification:', err);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// --- ADMIN NOTIFICATION TOOLS ---

// Post universal notification (Admin only)
app.post('/api/admin/broadcast-notification', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied: Admin only' });
    }
    const { message, type = 'admin' } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    // Get all active users
    const users = await UserModel.find({ isActive: true }).select('_id');

    // Create notifications in bulk
    const notifications = users.map(u => ({
      recipient: u._id,
      message,
      type,
      sender: req.user.userId
    }));

    await NotificationModel.insertMany(notifications);

    // Emit via socket to everyone online
    if (ioInstance) {
      ioInstance.emit('new_broadcast', { message, type });
    }

    res.json({ success: true, message: `Broadcasted to ${users.length} users` });
  } catch (err) {
    console.error(' Broadcast error:', err);
    res.status(500).json({ error: 'Failed to broadcast notification' });
  }
});

// --- INTERNAL ANALYTICS ---

// Track Visit (Call from frontend)
app.post('/api/stats/track-visit', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    // Check if this IP already visited today
    const visitor = await VisitorModel.findOneAndUpdate(
      { date: today, ip },
      { $inc: { totalViews: 1 }, lastVisited: new Date() },
      { upsert: true, new: true }
    );
    res.json({ success: true, visitId: visitor._id });
  } catch (err) {
    res.status(500).json({ error: 'Stats recording failed' });
  }
});

// Admin Stats Dashboard
app.get('/api/admin/stats-overview', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

    const today = new Date().toISOString().split('T')[0];
    const totalUsers = await UserModel.countDocuments();
    const uniqueVisitorsToday = await VisitorModel.countDocuments({ date: today });
    const loginStats = await StatsModel.findOne({ key: 'total_logins' });
    const totalQuestions = await QuizModel.countDocuments().catch(() => 0); // Count total quiz entries as a metric

    res.json({
      success: true,
      stats: {
        totalUsers,
        todayUniqueVisitors: uniqueVisitorsToday,
        totalLifetimeLogins: loginStats ? loginStats.value : 0,
        totalQuestionsBank: totalQuestions
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

app.get('/api/notes', async (req, res) => {
  try {
    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      return res.json({ notes: [] }); // Return empty array if DB not connected
    }
    const notes = await NoteModel.find().sort({ createdAt: -1 });
    res.json({ notes });
  } catch (err) {
    console.error('Error fetching notes:', err);
    res.json({ notes: [] }); // Return empty array on error
  }
});

app.get('/api/notes/:id/download', async (req, res) => {
  try {
    const note = await NoteModel.findById(req.params.id);
    if (!note) return res.status(404).json({ error: 'Note not found' });
    
    // Support both multi-file (files array) and legacy (filePath field)
    let filePath = note.filePath;
    if (!filePath && note.files && note.files[0]) {
      filePath = note.files[0].path;
    }
    
    if (!filePath) return res.status(404).json({ error: 'No file available' });
    
    const fileName = note.fileName || (filePath ? path.basename(filePath) : 'note.pdf');
    const localPath = path.join(notesDir, path.basename(filePath));
    const resolvedPath = fs.existsSync(localPath) ? localPath : filePath;
    
    if (!fs.existsSync(resolvedPath)) {
      console.warn('[DOWNLOAD] File not found:', resolvedPath);
      return res.status(404).json({ error: 'File missing' });
    }
    
    res.download(resolvedPath, fileName);
  } catch (err) {
    console.error('Error downloading note:', err);
    res.status(500).json({ error: 'Failed to download note' });
  }
});

app.get('/api/notes/:id/files/:fileIndex/download', async (req, res) => {
  try {
    const note = await NoteModel.findById(req.params.id);
    if (!note) return res.status(404).json({ error: 'Note not found' });
    
    let file = null;
    const idx = parseInt(req.params.fileIndex);
    
    if (note.files && note.files[idx]) {
      file = note.files[idx];
    } else if (idx === 0 && note.filePath) {
      // Handle legacy single-file notes in multi-file route
      file = { path: note.filePath, name: note.fileName };
    }
    
    if (!file) return res.status(404).json({ error: 'File not found' });
    
    const fileName = path.basename(file.path);
    const localPath = path.join(notesDir, fileName);
    const resolvedPath = fs.existsSync(localPath) ? localPath : file.path;
    
    if (!fs.existsSync(resolvedPath)) {
      console.warn('[DOWNLOAD] File missing:', resolvedPath);
      return res.status(404).json({ error: 'File missing' });
    }
    
    res.download(resolvedPath, file.name || fileName);
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});


app.get('/api/notes/:id/view', async (req, res) => {
  try {
    const note = await NoteModel.findById(req.params.id);
    if (!note) return res.status(404).json({ error: 'Note not found' });
    
    // Check files array first, then fallback to legacy filePath
    let filePath = note.filePath;
    let fileName = note.fileName || 'note.pdf';
    
    // For legacy single file, we use filePath (if present)
    // If it's a new multi-file note, we use the first file for this route
    if (!filePath && note.files && note.files.length > 0) {
      filePath = note.files[0].path;
      fileName = note.files[0].name;
    }
    
    if (!filePath || !fs.existsSync(filePath)) {
      console.warn(`[VIEW] File not found on disk at ${filePath}`);
      return res.status(404).json({ error: 'File not found on server' });
    }
    
    // Detect extension from the ORIGINAL fileName, not the disk filePath
    const ext = path.extname(fileName).toLowerCase();
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.txt': 'text/plain'
    };
    
    res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.sendFile(path.resolve(filePath));
  } catch (err) {
    console.error('View legacy note error:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

app.get('/api/notes/:id/files/:fileIndex/view', async (req, res) => {
  try {
    const note = await NoteModel.findById(req.params.id);
    if (!note) return res.status(404).json({ error: 'Note not found' });
    
    const idx = parseInt(req.params.fileIndex);
    if (!note.files || !note.files[idx]) return res.status(404).json({ error: 'File not found' });
    
    const file = note.files[idx];
    const fileName = path.basename(file.path);
    const localPath = path.join(notesDir, fileName);
    const resolvedPath = fs.existsSync(localPath) ? localPath : file.path;
    
    if (!fs.existsSync(resolvedPath)) return res.status(404).json({ error: 'File missing' });
    
    // Set content type based on extension
    const ext = path.extname(resolvedPath).toLowerCase();
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.txt': 'text/plain'
    };
    
    res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
    res.sendFile(path.resolve(resolvedPath));
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

app.delete('/api/notes/:id', async (req, res) => {
  try {
    const note = await NoteModel.findById(req.params.id);
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }
    // Check if user is the author (in real app, verify with auth token)
    if (req.query.authorId && note.authorId !== req.query.authorId) {
      return res.status(403).json({ error: 'You can only delete your own notes' });
    }
    // Delete file if exists
    if (note.filePath && fs.existsSync(note.filePath)) {
      fs.unlinkSync(note.filePath);
    }
    await NoteModel.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting note:', err);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

// Quiz Routes
app.post('/api/quiz/generate', quizUpload.single('file'), async (req, res) => {
  try {
    const { subject, numberOfQuestions } = req.body;
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log(' Generating quiz from file:', req.file.originalname);

    // Send file to Python AI service for quiz generation. Convert Word docs to text before sending if needed.
    const metadataToSend = {
      type: 'quiz',
      numberOfQuestions: parseInt(numberOfQuestions) || 10,
      subject: subject || undefined,
      difficultyOrder: req.body.difficultyOrder || 'low-to-high',
      forceOcr: req.body.forceOcr === 'true' || req.body.forceOcr === true || false,
      institutionName: req.body.institutionName || req.body.institution || undefined,
      state: req.body.state || undefined,
      semester: req.body.semester || undefined,
      year: req.body.year || undefined
    };

    const conv = await convertDocxToTextFile(req.file.path, req.file.originalname);
    const form = new FormData();
    form.append('files', fs.createReadStream(conv.path), conv.name);
    form.append('metadata', JSON.stringify(metadataToSend));

    let response;
    try {
      const pythonUrl = `${pythonBaseUrl}/generate-quiz`;
      response = await axios.post(pythonUrl, form, {
        headers: form.getHeaders(),
        timeout: 180000 // 3 minutes
      });
    } catch (axiosErr) {
      console.error(' Python AI service error:', axiosErr.message);
      // If Python service is not available, generate basic questions
      if (axiosErr.code === 'ECONNREFUSED' || axiosErr.code === 'ETIMEDOUT' || axiosErr.code === 'ECONNABORTED') {
        console.log(' Python service unavailable, generating basic questions');
        response = {
          data: {
            questions: Array.from({ length: parseInt(numberOfQuestions) || 10 }, (_, i) => ({
              question: `Question ${i + 1}: Based on the uploaded material, what is the main concept?`,
              options: [
                'Concept A from the material',
                'Concept B from the material',
                'Concept C from the material',
                'Concept D from the material'
              ],
              correctAnswer: 0
            }))
          }
        };
      } else {
        throw axiosErr;
      }
    } finally {
      // Clean up temporary converted file if present
      if (conv && conv.isTemp && conv.tmpPath) {
        fs.unlink(conv.tmpPath, () => { });
      }
    }

    // Get userId from token if authenticated
    let userId = null;
    const authHeader = req.headers['authorization'];
    if (authHeader) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        userId = decoded.userId;
      } catch (err) {
        // Token invalid or expired, continue without userId
      }
    }

    // Save quiz to database
    const resolvedSubject = (response.data && response.data.metadata && response.data.metadata.subject) || subject || 'General';
    const quiz = await QuizModel.create({
      subject: resolvedSubject,
      questions: response.data.questions || [],
      metadata: response.data.metadata || {},
      sourceFile: req.file.originalname,
      userId: userId
    });

    // Cleanup file
    fs.unlink(req.file.path, () => { });

    console.log(' Quiz generated:', quiz._id);

    // Notify all users about new quiz
    notifyAllUsers(
      `New practice quiz available for ${resolvedSubject}! Try it now.`,
      'quiz',
      userId,
      { quizId: quiz._id, subject: resolvedSubject }
    );

    res.json({ success: true, quiz });
  } catch (err) {
    console.error('Error generating quiz:', err);
    res.status(500).json({ error: 'Failed to generate quiz', detail: err.message });
  }
});

// Generate quiz PDF (direct download)
app.post('/api/quiz/generate_pdf', quizUpload.single('file'), async (req, res) => {
  try {
    const { numberOfQuestions, subject } = req.body;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const metadataToSend = {
      numberOfQuestions: parseInt(numberOfQuestions) || 10,
      subject: subject || undefined,
      difficultyOrder: req.body.difficultyOrder || 'low-to-high',
      forceOcr: req.body.forceOcr === 'true' || req.body.forceOcr === true || false,
      institutionName: req.body.institutionName || undefined,
      state: req.body.state || undefined,
      semester: req.body.semester || undefined,
      year: req.body.year || undefined
    };

    // Helper to create a fresh FormData with a fresh stream (streams are consumed on request)
    const createForm = () => {
      const f = new FormData();
      f.append('files', fs.createReadStream(req.file.path), req.file.originalname);
      f.append('metadata', JSON.stringify(metadataToSend));
      return f;
    };

    // Pre-check: request JSON quiz generation to confirm questions exist
    try {
      const checkForm = createForm();
      const checkUrl = `${pythonBaseUrl}/generate-quiz`;
      const checkResp = await axios.post(checkUrl, checkForm, { headers: checkForm.getHeaders(), timeout: 300000 });
      const questionCount = (checkResp.data && checkResp.data.questions && checkResp.data.questions.length) || 0;
      console.log('Python /generate-quiz returned question count:', questionCount);
      if (questionCount === 0) {
        return res.status(400).json({ error: 'No questions could be generated from this file. Try enabling Force OCR or use a clearer/scanned file.' });
      }
    } catch (checkErr) {
      // If check fails due to connectivity/timeouts, log and continue to attempt PDF generation; previous fallback existed
      console.error('Pre-check to Python generate-quiz failed:', checkErr && checkErr.message ? checkErr.message : checkErr);
      // continue
    }

    const form = createForm();
    const pythonUrl = `${pythonBaseUrl}/generate-quiz-pdf`;
    const response = await axios.post(pythonUrl, form, { headers: form.getHeaders(), responseType: 'arraybuffer', timeout: 300000 });
    const dataBuffer = Buffer.from(response.data || []);

    // Treat very small responses as empty / no-results (likely OCR failed or no questions produced)
    if (!dataBuffer || dataBuffer.length < 1000) {
      console.error('Python service returned small/empty PDF for generate-quiz-pdf (size:', dataBuffer ? dataBuffer.length : 0, ')');
      return res.status(400).json({ error: 'No questions were generated from the provided file. Try enabling Force OCR or use a clearer/scanned file.' });
    }

    if (response.headers['content-type']) res.set('Content-Type', response.headers['content-type']);
    if (response.headers['content-disposition']) res.set('Content-Disposition', response.headers['content-disposition']);
    res.send(dataBuffer);
  } catch (err) {
    console.error('Error generating quiz PDF:', err.message || err);
    res.status(500).json({ error: 'Failed to generate quiz PDF', detail: err.message });
  }
});

// Detect class/mode heuristics from uploaded notes (lightweight)
app.post('/api/exam/detect', quizUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const createForm = () => {
      const f = new FormData();
      f.append('files', fs.createReadStream(req.file.path), req.file.originalname);
      return f;
    };
    const form = createForm();
    const url = `${pythonBaseUrl}/generate-quiz`;
    const resp = await axios.post(url, form, { headers: form.getHeaders(), timeout: 300000 });
    const questions = (resp.data && resp.data.questions) || [];
    // Reuse detection logic from generate_paper
    const detectClassFromQuestions = (qs) => {
      if (!qs || qs.length === 0) return { mode: 'school', classLevel: undefined };
      const text = qs.map(q => (q.question || '') + ' ' + (q.options || []).join(' ')).join(' ').toLowerCase();
      let score = 0;
      const universityKeywords = ['derive', 'prove', 'differentiate', 'integration', 'integrate', 'eigen', 'determinant', 'theorem', 'assume', 'state and prove', 'justify', 'compare'];
      const higherKeywords = ['photosynthesis', 'osmosis', 'thermodynamics', 'electrolysis', 'acid', 'base', 'algebra', 'calculus', 'matrix', 'vector'];
      universityKeywords.forEach(k => { if (text.includes(k)) score += 3; });
      higherKeywords.forEach(k => { if (text.includes(k)) score += 2; });
      if (score >= 8) return { mode: 'university', classLevel: 12 };
      if (score >= 5) return { mode: 'school', classLevel: 11 };
      if (score >= 2) return { mode: 'school', classLevel: 8 };
      return { mode: 'school', classLevel: 6 };
    };
    const detected = detectClassFromQuestions(questions);
    res.json({ detected });
  } catch (err) {
    console.error('Error detecting class:', err.message || err);
    // Development fallback: if Python service is unreachable, return a heuristic default so the UI can proceed
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Python service unreachable — returning development fallback detected class');
      return res.json({ detected: { mode: 'school', classLevel: 10 } });
    }
    res.status(500).json({ error: 'Failed to detect class', detail: err.message });
  }
});

// Generate question paper (arrange by difficulty and download PDF)
app.post('/api/quiz/generate_paper', quizUpload.single('file'), async (req, res) => {
  try {
    const { numberOfQuestions, subject } = req.body;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // Advanced paper metadata
    const metadataToSend = {
      numberOfQuestions: parseInt(numberOfQuestions) || 10,
      subject: subject || undefined,
      difficultyOrder: req.body.difficultyOrder || 'low-to-high',
      // Manual mode and class level (frontend provides these when user chooses manual selection)
      mode: req.body.mode || 'school', // 'school' or 'university'
      classLevel: req.body.classLevel ? parseInt(req.body.classLevel) : undefined,
      // Templates / paper formats
      paperTemplate: req.body.paperTemplate || undefined,
      totalMarks: req.body.totalMarks ? parseInt(req.body.totalMarks) : undefined,
      examDuration: req.body.examDuration || undefined,
      includeAnswerKey: (typeof req.body.includeAnswerKey !== 'undefined') ? (req.body.includeAnswerKey === 'true' || req.body.includeAnswerKey === true) : true,
      includeMarkingScheme: (typeof req.body.includeMarkingScheme !== 'undefined') ? (req.body.includeMarkingScheme === 'true' || req.body.includeMarkingScheme === true) : true,
      // force OCR by default for paper generation unless explicit false
      forceOcr: (typeof req.body.forceOcr !== 'undefined') ? (req.body.forceOcr === 'true' || req.body.forceOcr === true) : true,
      includeOptions: (typeof req.body.includeOptions !== 'undefined') ? (req.body.includeOptions === 'true' || req.body.includeOptions === true) : false,
      includeMarks: req.body.includeMarks === 'true' || false,
      marksPerQuestion: parseInt(req.body.marksPerQuestion) || 1,
      timeLimit: req.body.timeLimit ? parseInt(req.body.timeLimit) : undefined,
      sectionsByDifficulty: req.body.sectionsByDifficulty === 'true' || false,
      shuffleQuestions: req.body.shuffleQuestions === 'true' || false,
      institutionName: req.body.institutionName || undefined,
      state: req.body.state || undefined,
      semester: req.body.semester || undefined,
      year: req.body.year || undefined
    };

    console.log('Generate paper metadata:', metadataToSend);

    // Helper to create a fresh FormData with a fresh stream (streams are consumed on request)
    const createForm = () => {
      const f = new FormData();
      f.append('files', fs.createReadStream(req.file.path), req.file.originalname);
      f.append('metadata', JSON.stringify(metadataToSend));
      return f;
    };

    // Optimization: Skip pre-check to save time, as OCR is slow. Directly attempt generation.

    const pythonUrl = `${pythonBaseUrl}/generate-question-paper`;
    const form = createForm();
    let dataBuffer;
    try {
      const response = await axios.post(pythonUrl, form, {
        headers: form.getHeaders(),
        responseType: 'arraybuffer',
        timeout: 300000 // 5 minutes for generation
      });
      dataBuffer = Buffer.from(response.data || []);

      // Treat very small responses as empty / no-results (likely OCR failed or no questions produced)
      if (!dataBuffer || dataBuffer.length < 1000) {
        console.error('Python service returned small/empty PDF for generate-question-paper (size:', dataBuffer ? dataBuffer.length : 0, ')');
        return res.status(400).json({ error: 'No questions were generated from the provided file. Try using clearer/scanned content or modify advanced options.' });
      }

      if (response.headers['content-type']) res.set('Content-Type', response.headers['content-type']);
      if (response.headers['content-disposition']) res.set('Content-Disposition', response.headers['content-disposition']);
      return res.send(dataBuffer);
    } catch (err) {
      console.error('Error communicating with Python service for question paper:', err.message || err);
      // Avoid silently returning a placeholder PDF — return an informative JSON error so the frontend can surface it
      return res.status(503).json({ error: 'Question paper generation service unavailable', detail: 'Unable to contact Python OCR/NLP service. Please ensure the service is running.' });
    }
  } catch (err) {
    console.error('Error generating question paper:', err.message || err);
    res.status(500).json({ error: 'Failed to generate question paper', detail: err.message });
  }
});

// Save Quiz Score
app.post('/api/quiz/score', authenticateToken, async (req, res) => {
  try {
    const { quizId, score, totalQuestions } = req.body;
    const percentage = Math.round((score / totalQuestions) * 100);
    
    const newScore = await QuizScoreModel.create({
      userId: req.user.userId,
      quizId: quizId || null,
      score,
      totalQuestions,
      percentage
    });
    
    res.json({ success: true, score: newScore });
  } catch (err) {
    console.error('Error saving quiz score:', err);
    res.status(500).json({ error: 'Failed to save quiz score' });
  }
});

// Get My Quiz Scores
app.get('/api/quiz/my-scores', authenticateToken, async (req, res) => {
  try {
    const scores = await QuizScoreModel.find({ userId: req.user.userId })
      .populate('quizId', 'subject')
      .sort({ createdAt: -1 });
    res.json({ success: true, scores });
  } catch (err) {
    console.error('Error fetching quiz scores:', err);
    res.status(500).json({ error: 'Failed to fetch quiz scores' });
  }
});

// Forum Routes - This will be replaced by the enhanced version below

app.get('/api/forum/posts', async (req, res) => {
  try {
    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      return res.json({ posts: [] }); // Return empty array if DB not connected
    }
    const posts = await PostModel.find().sort({ createdAt: -1 });
    res.json({ posts });
  } catch (err) {
    console.error('Error fetching posts:', err);
    res.json({ posts: [] }); // Return empty array on error
  }
});

app.post('/api/forum/posts/:id/reply', async (req, res) => {
  try {
    const { content, author, authorId } = req.body;
    const post = await PostModel.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    post.replies.push({
      content,
      author: author || 'Anonymous',
      authorId: authorId || 'user-' + Date.now()
    });
    await post.save();
    // Create notification for the post owner (if different)
    try {
      const postOwnerId = post.authorId;
      if (postOwnerId && postOwnerId.toString() !== (req.user ? req.user.userId : '')) {
        await createNotification(
          postOwnerId, 
          `Your post "${post.title}" has a new reply by ${author || 'Anonymous'}`,
          'forum_reply',
          authorId,
          { postId: post._id }
        );
      }
    } catch (e) {
      console.error('Error creating reply notification:', e);
    }
    res.json({ success: true, post });
  } catch (err) {
    console.error('Error adding reply:', err);
    res.status(500).json({ error: 'Failed to add reply' });
  }
});

// ---------------- Notifications API ----------------
// Get notifications for current user
app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const notifs = await MessageModel.find({ toUserId: req.user.userId }).sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, notifications: notifs });
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark all notifications read
app.post('/api/notifications/read-all', authenticateToken, async (req, res) => {
  try {
    await MessageModel.updateMany({ toUserId: req.user.userId, isRead: false }, { isRead: true });
    res.json({ success: true });
  } catch (err) {
    console.error('Error marking all notifications read:', err);
    res.status(500).json({ error: 'Failed to update notifications' });
  }
});

// Mark notification read
app.patch('/api/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    const msg = await MessageModel.findByIdAndUpdate(req.params.id, { isRead: true }, { new: true });
    if (!msg) return res.status(404).json({ error: 'Notification not found' });
    res.json({ success: true, notification: msg });
  } catch (err) {
    console.error('Error updating notification:', err);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// Generate analysis PDF report (proxy to Python service)
// Report generation is allowed without authentication so students can download PDFs freely.
app.post('/api/analysis/report', async (req, res) => {
  try {
    // Expect body with { groups, unique, metadata }
    const payload = req.body || {};
    const pythonUrl = `${pythonBaseUrl}/generate_report`;
    const response = await axios.post(pythonUrl, payload, { responseType: 'arraybuffer', timeout: 300000 });
    // Forward content headers from Python service when available
    if (response.headers && response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type']);
    } else {
      res.set('Content-Type', 'application/pdf');
    }
    if (response.headers && response.headers['content-disposition']) {
      res.set('Content-Disposition', response.headers['content-disposition']);
    } else {
      res.set('Content-Disposition', 'attachment; filename="analysis_report.pdf"');
    }
    res.send(Buffer.from(response.data));
  } catch (err) {
    console.error('Error generating analysis report:', err.message || err);
    res.status(500).json({ error: 'Failed to generate report', detail: err.message });
  }
});

// Study Hub: proxy search to Python and return match
app.post('/api/studyhub/search', authenticateToken, async (req, res) => {
  try {
    const { question, subject, noteId } = req.body || {};
    if (!question) return res.status(400).json({ error: 'Question is required' });

    // If noteId is provided, resolve filePath and send to python search to limit scope
    let payload = { question, subject };
    
    if (noteId) {
      try {
        const note = await NoteModel.findById(noteId);
        if (note) {
          if (note.filePath) {
            payload.filePath = note.filePath;
          } else if (note.files && note.files.length > 0) {
            payload.filePaths = note.files.map(f => f.path);
          }
        }
      } catch (e) {
        console.warn('Unable to find note for noteId', noteId, e.message || e);
      }
    } else {
      // Fetch ALL note paths from DB to search across all study materials
      try {
        const allNotes = await NoteModel.find({}, 'filePath files');
        const paths = [];
        allNotes.forEach(note => {
          if (note.filePath) paths.push(note.filePath);
          if (note.files && note.files.length > 0) {
            note.files.forEach(f => paths.push(f.path));
          }
        });
        if (paths.length > 0) {
          payload.filePaths = [...new Set(paths)]; // Unique paths
        }
      } catch (e) {
        console.warn('Error fetching all notes for search', e.message);
      }
    }

    const pythonUrl = `${pythonBaseUrl}/search_pdf`;
    const response = await axios.post(pythonUrl, payload, { timeout: 30000 });
    res.json({ success: true, result: response.data });
  } catch (err) {
    console.error('StudyHub search error:', err.message || err);
    res.status(500).json({ error: 'Search failed', detail: err.message });
  }
});

// Generate docx containing repeated & unique questions
app.post('/api/analysis/docx', authenticateToken, async (req, res) => {
  try {
    const payload = req.body || {};
    const pythonUrl = `${pythonBaseUrl}/generate_docx`;
    const response = await axios.post(pythonUrl, payload, { responseType: 'arraybuffer', timeout: 300000 });
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.set('Content-Disposition', 'attachment; filename="analysis_questions.docx"');
    res.send(Buffer.from(response.data));
  } catch (err) {
    console.error('Error generating docx:', err.message || err);
    res.status(500).json({ error: 'Failed to generate docx', detail: err.message });
  }
});

// Serve a PDF file found by search (safe-guarded to uploads/notes folder)
app.get('/api/studyhub/open', authenticateToken, async (req, res) => {
  try {
    const p = req.query.path;
    if (!p) return res.status(400).json({ error: 'path query required' });
    const decoded = decodeURIComponent(p);
    const abs = path.resolve(decoded);
    // Only allow files under uploads or python_ai data directories
    const uploadsRoot = path.resolve(path.join(__dirname, 'uploads'));
    const notesRoot = path.resolve(path.join(__dirname, 'uploads', 'notes'));
    if (!abs.startsWith(uploadsRoot) && !abs.startsWith(notesRoot)) {
      return res.status(403).json({ error: 'Access to file denied' });
    }
    if (!fs.existsSync(abs)) return res.status(404).json({ error: 'File not found' });
    res.sendFile(abs);
  } catch (err) {
    console.error('Error serving studyhub file:', err);
    res.status(500).json({ error: 'Failed to serve file' });
  }
});

// Save Quiz Score
app.post('/api/quiz/score', authenticateToken, async (req, res) => {
  try {
    const { quizId, score, totalQuestions } = req.body;

    if (score === undefined || !totalQuestions) {
      return res.status(400).json({ error: 'Score and total questions are required' });
    }

    const percentage = Math.round((score / totalQuestions) * 100);

    const quizScore = await QuizScoreModel.create({
      userId: req.user.userId,
      quizId: quizId || null,
      score,
      totalQuestions,
      percentage
    });

    res.json({ success: true, quizScore });
  } catch (err) {
    console.error('Error saving quiz score:', err);
    res.status(500).json({ error: 'Failed to save quiz score' });
  }
});

// Get User Statistics
app.get('/api/user/statistics', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userIdString = userId.toString();

    // Count papers uploaded - userId is stored as ObjectId in UploadModel
    const papersUploaded = await UploadModel.countDocuments({ userId: userId });

    // Count quizzes taken - userId is stored as ObjectId
    const quizzesTaken = await QuizScoreModel.countDocuments({ userId: userId });

    // Count forum posts - authorId is stored as String
    const forumPosts = await PostModel.countDocuments({
      $or: [
        { authorId: userIdString },
        { authorId: userId.toString() }
      ]
    });

    // Calculate average score
    const quizScores = await QuizScoreModel.find({ userId: userId });
    let averageScore = 0;
    if (quizScores.length > 0) {
      const totalPercentage = quizScores.reduce((sum, qs) => sum + (qs.percentage || 0), 0);
      averageScore = Math.round(totalPercentage / quizScores.length);
    }

    // Debug logging
    console.log('Statistics for user:', userId, {
      papersUploaded,
      quizzesTaken,
      forumPosts,
      averageScore
    });

    res.json({
      success: true,
      statistics: {
        papersUploaded: papersUploaded || 0,
        quizzesTaken: quizzesTaken || 0,
        forumPosts: forumPosts || 0,
        averageScore: averageScore || 0
      }
    });
  } catch (err) {
    console.error('Error fetching statistics:', err);
    res.status(500).json({ error: 'Failed to fetch statistics', detail: err.message });
  }
});

app.post('/api/forum/posts/:id/like', authenticateToken, async (req, res) => {
  try {
    const post = await PostModel.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    const userId = req.user.userId.toString();
    if (post.likedBy.includes(userId)) {
      post.likes -= 1;
      post.likedBy = post.likedBy.filter(id => id !== userId);
    } else {
      post.likes += 1;
      post.likedBy.push(userId);
    }
    await post.save();
    res.json({ success: true, likes: post.likes });
  } catch (err) {
    console.error('Error liking post:', err);
    res.status(500).json({ error: 'Failed to like post' });
  }
});

// Update forum post creation to notify other students (mentor role removed)
app.post('/api/forum/posts', authenticateToken, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database not connected. Please ensure MongoDB is running.' });
    }

    const { title, content, author } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    const user = await UserModel.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Allow students, admins, and mentors (legacy) to create forum posts
    if (user.role !== 'student' && user.role !== 'admin' && user.role !== 'mentor') {
      return res.status(403).json({ error: 'Only authorized users can create forum posts' });
    }

    const post = await PostModel.create({
      title,
      content,
      author: author || user.fullName,
      authorId: req.user.userId.toString()
    });

    // Notify all other students about new post using the helper
    notifyAllUsers(
      `${user.fullName} asked a new question: "${title}". Click to reply and help!`,
      'forum_post',
      req.user.userId,
      { postId: post._id, title: post.title }
    );

    console.log('Post created:', post._id);
    res.json({ success: true, post });
  } catch (err) {
    console.error(' Error creating post:', err);
    res.status(500).json({ error: 'Failed to create post', detail: err.message });
  }
});

// ==================== ADMIN ROUTES ====================

// Admin: delete forum post
app.delete('/api/forum/posts/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const post = await PostModel.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    await PostModel.findByIdAndDelete(req.params.id);
    // Optionally remove related messages/notifications
    await MessageModel.deleteMany({ forumPostId: req.params.id }).catch(() => { });
    res.json({ success: true, message: 'Post deleted' });
  } catch (err) {
    console.error('Error deleting post:', err);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// Get all users (Admin only)
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await UserModel.find().select('-password').sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// (Admin mentors endpoint removed)

// Delete user account (Admin only)
app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const user = await UserModel.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Don't allow deleting admin accounts
    if (user.role === 'admin') {
      return res.status(403).json({ error: 'Cannot delete admin accounts' });
    }

    await UserModel.findByIdAndDelete(req.params.id);
    console.log(' User deleted by admin:', user.email);
    res.json({ success: true, message: 'User account deleted successfully' });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Activate/Deactivate user (Admin only)
app.patch('/api/admin/users/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { isActive } = req.body;
    const user = await UserModel.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true, user });
  } catch (err) {
    console.error('Error updating user status:', err);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

// Delete forum post (Admin only)
app.delete('/api/admin/forum/posts/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const post = await PostModel.findByIdAndDelete(req.params.id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    console.log(' Forum post deleted by admin:', post._id);
    res.json({ success: true, message: 'Post deleted successfully' });
  } catch (err) {
    console.error('Error deleting post:', err);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// Delete study note (Admin only)
app.delete('/api/admin/notes/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const note = await NoteModel.findById(req.params.id);
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // Delete file if exists
    if (note.filePath && fs.existsSync(note.filePath)) {
      fs.unlinkSync(note.filePath);
    }

    await NoteModel.findByIdAndDelete(req.params.id);
    console.log(' Study note deleted by admin:', note._id);
    res.json({ success: true, message: 'Note deleted successfully' });
  } catch (err) {
    console.error('Error deleting note:', err);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

// (Mentor notification routes removed — notifications now target students and in-app admin monitoring)

// Admin Announcements Routes
app.get('/api/admin/announcements', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const announcements = await PostModel.find({ type: 'announcement' })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, announcements });
  } catch (err) {
    console.error('Error fetching announcements:', err);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

app.post('/api/admin/announcements', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { title, content, type, isVisible } = req.body;

    console.log('Creating announcement with data:', { title, content, type, isVisible, userId: req.user?.userId });

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    if (!req.user || !req.user.userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    // Get user details for author name
    let authorName = 'Admin';
    try {
      const user = await UserModel.findById(req.user.userId).select('fullName email');
      if (user) {
        authorName = user.fullName || user.email || 'Admin';
      }
    } catch (userErr) {
      console.warn('Could not fetch user details:', userErr);
    }

    const announcement = await PostModel.create({
      title: title.trim(),
      content: content.trim(),
      author: authorName,
      authorId: req.user.userId.toString(),
      type: 'announcement',
      isVisible: isVisible !== false && isVisible !== 'false',
      likes: 0,
      likedBy: []
    });

    console.log('Announcement created successfully:', announcement._id);
    res.json({ success: true, announcement });
  } catch (err) {
    console.error('Error creating announcement:', err);
    const errorDetail = err.message || err.toString();
    res.status(500).json({
      error: 'Failed to create announcement',
      detail: errorDetail
    });
  }
});

app.put('/api/admin/announcements/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { title, content, type, isVisible } = req.body;

    console.log('Updating announcement:', req.params.id, { title, content, type, isVisible });

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    const updateData = {
      title: title.trim(),
      content: content.trim(),
      type: type || 'general',
      isVisible: isVisible !== false && isVisible !== 'false'
    };

    const announcement = await PostModel.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!announcement) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    console.log('Announcement updated successfully:', announcement._id);
    res.json({ success: true, announcement });
  } catch (err) {
    console.error('Error updating announcement:', err);
    res.status(500).json({ error: 'Failed to update announcement', detail: err.message });
  }
});

app.delete('/api/admin/announcements/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const announcement = await PostModel.findByIdAndDelete(req.params.id);
    if (!announcement) {
      return res.status(404).json({ error: 'Announcement not found' });
    }
    res.json({ success: true, message: 'Announcement deleted successfully' });
  } catch (err) {
    console.error('Error deleting announcement:', err);
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
});

// Get announcements for users (visible ones only)
app.get('/api/announcements', async (req, res) => {
  try {
    const announcements = await PostModel.find({
      type: 'announcement',
      isVisible: true
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    res.json({ success: true, announcements });
  } catch (err) {
    console.error('Error fetching announcements:', err);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

// Public Question Papers Route for Study Hub
app.get('/api/question-papers', async (req, res) => {
  try {
    const papers = await UploadModel.find({
      // Assuming papers created via admin have specific markers or we just show all Uploads that are "papers"
      // For now, let's treat all records in UploadModel as papers, or filter by those with levelType/classLevel
      levelType: { $ne: null }
    })
      .sort({ createdAt: -1 })
      .lean()
      .then(papers => papers.map(paper => ({
        _id: paper._id,
        title: paper.levelType || 'Official Paper',
        subject: paper.classLevel || 'General',
        fileName: paper.files && paper.files.length > 0 ? path.basename(paper.files[0]) : '',
        createdAt: paper.createdAt
      })));
    res.json({ success: true, papers });
  } catch (err) {
    console.error('Error fetching public question papers:', err);
    res.status(500).json({ error: 'Failed to fetch question papers' });
  }
});

// Admin Question Papers Routes
app.get('/api/admin/question-papers', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const papers = await UploadModel.find()
      .sort({ createdAt: -1 })
      .lean()
      .then(papers => papers.map(paper => ({
        _id: paper._id,
        title: paper.levelType || paper.classLevel || 'Question Paper',
        subject: paper.classLevel || paper.levelType || 'General',
        classLevel: paper.classLevel || '',
        examType: paper.levelType || '',
        visibility: 'public',
        fileName: paper.files && paper.files[0] ? path.basename(paper.files[0]) : null,
        createdAt: paper.createdAt
      })));
    res.json({ success: true, papers });
  } catch (err) {
    console.error('Error fetching question papers:', err);
    res.status(500).json({ error: 'Failed to fetch question papers' });
  }
});

app.post('/api/admin/question-papers', authenticateToken, requireAdmin, upload.single('file'), async (req, res) => {
  try {
    const { title, subject, classLevel, examType, visibility } = req.body;

    if (!title || !subject) {
      return res.status(400).json({ error: 'Title and subject are required' });
    }

    // Save to UploadModel (reusing existing schema)
    const paper = await UploadModel.create({
      levelType: title,
      classLevel: subject || classLevel || '',
      institutionName: '',
      files: req.file ? [req.file.path] : [],
      groups: [],
      unique: []
    });

    res.json({ success: true, paper });
  } catch (err) {
    console.error('Error creating question paper:', err);
    res.status(500).json({ error: 'Failed to create question paper', detail: err.message });
  }
});

app.put('/api/admin/question-papers/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { title, subject, classLevel, examType, visibility } = req.body;
    const paper = await UploadModel.findByIdAndUpdate(
      req.params.id,
      {
        levelType: title,
        classLevel: subject || classLevel || ''
      },
      { new: true }
    );

    if (!paper) {
      return res.status(404).json({ error: 'Question paper not found' });
    }

    res.json({ success: true, paper });
  } catch (err) {
    console.error('Error updating question paper:', err);
    res.status(500).json({ error: 'Failed to update question paper', detail: err.message });
  }
});

app.delete('/api/admin/question-papers/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const paper = await UploadModel.findByIdAndDelete(req.params.id);
    if (!paper) {
      return res.status(404).json({ error: 'Question paper not found' });
    }

    // Delete associated files
    if (paper.files && paper.files.length > 0) {
      paper.files.forEach(filePath => {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (fileErr) {
          console.warn('Failed to delete file:', filePath, fileErr);
        }
      });
    }

    res.json({ success: true, message: 'Question paper deleted successfully' });
  } catch (err) {
    console.error('Error deleting question paper:', err);
    res.status(500).json({ error: 'Failed to delete question paper' });
  }
});

// Admin Notes Routes (GET and PUT)
app.get('/api/admin/notes', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const notes = await NoteModel.find()
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, notes });
  } catch (err) {
    console.error('Error fetching notes:', err);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

app.put('/api/admin/notes/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, subject, description } = req.body;
    const note = await NoteModel.findByIdAndUpdate(
      req.params.id,
      { name, subject, description },
      { new: true }
    );

    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    res.json({ success: true, note });
  } catch (err) {
    console.error('Error updating note:', err);
    res.status(500).json({ error: 'Failed to update note', detail: err.message });
  }
});

app.post('/api/admin/notes', authenticateToken, requireAdmin, notesUpload.array('files', 15), async (req, res) => {
  try {
    const { name, subject, description } = req.body;
    const uploadedFiles = (req.files || []).map(f => ({
      name: f.originalname,
      path: f.path
    }));

    if (uploadedFiles.length === 0) return res.status(400).json({ error: 'At least one file is required' });

    const note = await NoteModel.create({
      name,
      author: 'Admin',
      authorId: req.user.userId,
      role: 'admin',
      subject: subject || 'General',
      description: description || '',
      files: uploadedFiles,
      fileName: uploadedFiles[0].name,
      filePath: uploadedFiles[0].path
    });

    res.json({ success: true, note });
  } catch (err) {
    console.error('Error uploading note:', err);
    res.status(500).json({ error: 'Failed to upload note', detail: err.message });
  }
});

app.get('/api/admin/notes/:id/files/:fileIndex/download', async (req, res) => {
  try {
    const note = await NoteModel.findById(req.params.id);
    if (!note) return res.status(404).json({ error: 'Note not found' });
    
    const fileIndex = parseInt(req.params.fileIndex);
    if (!note.files || !note.files[fileIndex]) return res.status(404).json({ error: 'File index not found' });
    
    const file = note.files[fileIndex];
    const fileName = path.basename(file.path);
    const localPath = path.join(notesDir, fileName);
    const resolvedPath = fs.existsSync(localPath) ? localPath : file.path;
    
    if (!fs.existsSync(resolvedPath)) return res.status(404).json({ error: 'File not found on server' });
    
    res.download(resolvedPath, file.name || fileName);
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

app.delete('/api/admin/notes/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const note = await NoteModel.findById(req.params.id);
    if (!note) return res.status(404).json({ error: 'Note not found' });

    // Delete file if exists
    if (note.filePath && fs.existsSync(note.filePath)) {
      try {
        fs.unlinkSync(note.filePath);
      } catch (fileErr) {
        console.warn('Failed to delete file from disk:', fileErr);
      }
    }

    await NoteModel.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Note deleted permanently' });
  } catch (err) {
    console.error('Error deleting note:', err);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

// Admin Dashboard Statistics
app.get('/api/admin/dashboard', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const totalUsers = await UserModel.countDocuments();
    const totalPapers = await UploadModel.countDocuments();
    const totalNotes = await NoteModel.countDocuments();
    const totalAnnouncements = await PostModel.countDocuments({ type: 'announcement' });

    const recentUsers = await UserModel.find()
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    const recentPapers = await UploadModel.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .lean()
      .then(papers => papers.map(paper => ({
        _id: paper._id,
        title: paper.levelType || paper.classLevel || 'Question Paper',
        subject: paper.classLevel || paper.levelType || 'General',
        visibility: 'public',
        createdAt: paper.createdAt
      })));

    res.json({
      success: true,
      statistics: {
        totalUsers,
        totalPapers,
        totalNotes,
        totalAnnouncements
      },
      recentUsers,
      recentPapers
    });
  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

// Create new admin (Admin only)
app.post('/api/admin/create', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { fullName, email, phone, password } = req.body;

    if (!fullName || !email || !phone || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user already exists
    const existingUser = await UserModel.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create admin user
    const newAdmin = await UserModel.create({
      fullName,
      email,
      phone,
      password: hashedPassword,
      role: 'admin',
      isActive: true
    });

    res.json({
      success: true,
      message: 'Admin created successfully',
      user: {
        _id: newAdmin._id,
        fullName: newAdmin.fullName,
        email: newAdmin.email,
        role: newAdmin.role
      }
    });
  } catch (err) {
    console.error('Error creating admin:', err);
    res.status(500).json({ error: 'Failed to create admin' });
  }
});

// Update user profile (Admin only)
app.put('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Don't allow changing role to admin (use create admin endpoint instead)
    if (updateData.role === 'admin') {
      return res.status(403).json({ error: 'Cannot change user role to admin. Use create admin endpoint instead.' });
    }

    // Remove password from update if present
    delete updateData.password;

    const user = await UserModel.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true, user });
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Get website settings (Public)
app.get('/api/settings', async (req, res) => {
  try {
    let settings = await SettingsModel.findOne().lean();
    if (!settings) {
      settings = {
        websiteName: 'ExamSeva',
        logoUrl: '',
        contactEmail: 'support@examseva.com',
        contactPhone: '022-05200',
        contactAddress: '123 Education Street, Mumbai City, 400005',
        aboutUs: '',
        footerLinks: []
      };
    }
    res.json({ success: true, settings });
  } catch (err) {
    console.error('Error fetching public settings:', err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Get website settings (Admin only)
app.get('/api/admin/settings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    let settings = await SettingsModel.findOne().lean();
    if (!settings) {
      settings = {
        websiteName: 'ExamSeva',
        logoUrl: '',
        contactEmail: 'support@examseva.com',
        contactPhone: '022-05200',
        contactAddress: '123 Education Street, Mumbai City, 400005',
        aboutUs: '',
        footerLinks: []
      };
    }
    res.json({ success: true, settings });
  } catch (err) {
    console.error('Error fetching settings:', err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update website settings (Admin only)
app.put('/api/admin/settings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const updateData = req.body;
    updateData.updatedAt = new Date();

    const settings = await SettingsModel.findOneAndUpdate(
      {}, // Match the first/only settings document
      updateData,
      { new: true, upsert: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Settings updated successfully',
      settings
    });
  } catch (err) {
    console.error('Error updating settings:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Get reports/data (Admin only)
app.get('/api/admin/reports', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { type, startDate, endDate } = req.query;

    let reports = {};

    if (!type || type === 'users') {
      const userStats = {
        total: await UserModel.countDocuments(),
        active: await UserModel.countDocuments({ isActive: true }),
        inactive: await UserModel.countDocuments({ isActive: false }),
        students: await UserModel.countDocuments({ role: 'student' }),
        admins: await UserModel.countDocuments({ role: 'admin' })
      };
      reports.users = userStats;
    }

    if (!type || type === 'uploads') {
      const uploadStats = {
        total: await UploadModel.countDocuments(),
        withGroups: await UploadModel.countDocuments({ groups: { $exists: true, $ne: [] } }),
        withUnique: await UploadModel.countDocuments({ unique: { $exists: true, $ne: [] } })
      };
      reports.uploads = uploadStats;
    }

    if (!type || type === 'notes') {
      const notesStats = {
        total: await NoteModel.countDocuments()
      };
      reports.notes = notesStats;
    }

    if (!type || type === 'forum') {
      const forumStats = {
        totalPosts: await PostModel.countDocuments(),
        totalLikes: await PostModel.aggregate([
          { $group: { _id: null, total: { $sum: '$likes' } } }
        ]).then(result => result[0]?.total || 0)
      };
      reports.forum = forumStats;
    }

    res.json({ success: true, reports });
  } catch (err) {
    console.error('Error fetching reports:', err);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// ==================== CHAT/MESSAGING ROUTES ====================

// Send message (Student to Mentor or Mentor to Student)
app.post('/api/chat/send', authenticateToken, async (req, res) => {
  try {
    const { toUserId, message, forumPostId } = req.body;

    if (!toUserId || !message) {
      return res.status(400).json({ error: 'Recipient and message are required' });
    }

    const fromUser = await UserModel.findById(req.user.userId);
    const toUser = await UserModel.findById(toUserId);

    if (!fromUser || !toUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Allow messaging between any active users (mentor role removed)

    const newMessage = await MessageModel.create({
      fromUserId: req.user.userId,
      toUserId,
      forumPostId: forumPostId || null,
      message,
      isRead: false
    });

    const populatedMessage = await MessageModel.findById(newMessage._id)
      .populate('fromUserId', 'fullName role')
      .populate('toUserId', 'fullName role')
      .populate('forumPostId', 'title');

    // Emit real-time message event to recipient if connected
    try {
      io.to(toUserId.toString()).emit('new_message', populatedMessage);
    } catch (e) { }

    res.json({ success: true, message: populatedMessage });
  } catch (err) {
    console.error('Error sending message:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Get conversation between two users
app.get('/api/chat/conversation/:otherUserId', authenticateToken, async (req, res) => {
  try {
    const { otherUserId } = req.params;

    const messages = await MessageModel.find({
      $or: [
        { fromUserId: req.user.userId, toUserId: otherUserId },
        { fromUserId: otherUserId, toUserId: req.user.userId }
      ]
    })
      .populate('fromUserId', 'fullName role')
      .populate('toUserId', 'fullName role')
      .populate('forumPostId', 'title');

    // Mark messages as read
    await MessageModel.updateMany(
      { fromUserId: otherUserId, toUserId: req.user.userId, isRead: false },
      { isRead: true }
    );

    res.json({ success: true, messages });
  } catch (err) {
    console.error('Error fetching conversation:', err);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

// Get all conversations for current user
app.get('/api/chat/conversations', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get distinct conversation partners
    const conversations = await MessageModel.aggregate([
      {
        $match: {
          $or: [
            { fromUserId: userId },
            { toUserId: userId }
          ]
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$fromUserId', userId] },
              '$toUserId',
              '$fromUserId'
            ]
          },
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$toUserId', userId] }, { $eq: ['$isRead', false] }] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    // Populate user details
    const populatedConversations = await Promise.all(
      conversations.map(async (conv) => {
        const otherUser = await UserModel.findById(conv._id).select('fullName role email phone');
        return {
          otherUser,
          lastMessage: conv.lastMessage,
          unreadCount: conv.unreadCount
        };
      })
    );

    res.json({ success: true, conversations: populatedConversations });
  } catch (err) {
    console.error('Error fetching conversations:', err);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Create HTTP server and attach Socket.IO for realtime notifications
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    credentials: true
  },
  transports: ['websocket']
});
ioInstance = io;

// Simple socket handling: clients join a room named by their userId
io.on('connection', (socket) => {
  socket.on('join', (userId) => {
    try { socket.join(userId); } catch (e) { }
  });
});

const PORT = process.env.PORT || 4000;

// Start server
const nodeServer = server.listen(PORT, () => {
  console.log(`\n Backend server started!`);
  console.log(` Server running on http://localhost:${PORT}`);
});

// Configure server timeouts (Required for long-running AI processes)
nodeServer.timeout = 600000;       // 10 minutes
nodeServer.keepAliveTimeout = 610000;
nodeServer.headersTimeout = 620000;
