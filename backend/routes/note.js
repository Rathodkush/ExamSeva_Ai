const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const Note = require('../models/Note');
const { upload } = require('../middleware/upload');

// Get all notes
router.get('/', async (req, res) => {
  try {
    const notes = await Note.find().sort({ createdAt: -1 });
    res.json({ success: true, notes });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// Upload note
router.post('/', upload.single('file'), async (req, res) => {
  try {
    const { name, author, authorId, role, subject, description } = req.body;
    const note = await Note.create({
      name, author, authorId, role, subject, description,
      fileName: req.file.originalname,
      filePath: req.file.path
    });
    res.json({ success: true, note });
  } catch (err) {
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Download note
router.get('/:id/download', async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ error: 'Not found' });
    res.download(note.filePath, note.fileName);
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

module.exports = router;
