const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const mammoth = require('mammoth');
const Upload = require('../models/Upload');
const User = require('../models/User');
const upload = require('../middleware/upload');
const { authenticateToken } = require('../middleware/auth');

// Upload and Analyze Paper
router.post('/upload', upload.array('files'), async (req, res) => {
  try {
    const { levelType, institutionName, state, classLevel, degreeName, semester, year, userId } = req.body;
    const files = req.files || [];

    if (!files.length) return res.status(400).json({ error: 'No files provided' });

    // AI Analysis Logic (Forwarding to Python AI)
    const formData = new FormData();
    files.forEach(f => formData.append('files', fs.createReadStream(f.path)));
    
    // Simulate AI for this refactor demo, but in real use we call the python_ai service
    // const aiResponse = await axios.post('http://localhost:5000/analyze', formData, { ... });

    const newUpload = await Upload.create({
      levelType, institutionName, state, classLevel, degreeName, semester, year,
      files: files.map(f => f.path),
      userId: userId || null
    });

    res.json({ success: true, upload: newUpload });
  } catch (err) {
    res.status(500).json({ error: 'Upload failed' });
  }
});

// GET Public/Admin Papers
router.get('/list', async (req, res) => {
  try {
    const uploads = await Upload.find().sort({ createdAt: -1 });
    res.json({ success: true, uploads });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

module.exports = router;
