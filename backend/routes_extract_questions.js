const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const FormData = require('form-data');
const axios = require('axios');

// This route extracts questions (JSON) from an uploaded file using the Python service's /generate-quiz endpoint
// It returns { questions: [ { text, options: [] } ] } and respects metadata includeOptions

// Using centralized upload middleware
const { upload } = require('./middleware/upload');


router.post('/api/quiz/extract-questions', upload.single('file'), async (req, res) => {
  try {
    // multer middleware already saved file to disk at req.file
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const numberOfQuestions = req.body.numberOfQuestions || 10;
    const includeOptions = req.body.includeOptions === 'true' || req.body.includeOptions === true;

    const metadataToSend = {
      type: 'quiz',
      numberOfQuestions: parseInt(numberOfQuestions) || 10,
      subject: req.body.subject || undefined,
      difficultyOrder: req.body.difficultyOrder || 'low-to-high',
      forceOcr: req.body.forceOcr === 'true' || req.body.forceOcr === true || false
    };

    const form = new FormData();
    form.append('files', fs.createReadStream(req.file.path), req.file.originalname);
    form.append('metadata', JSON.stringify(metadataToSend));

    const pythonUrl = process.env.PYTHON_URL_BASE ? `${process.env.PYTHON_URL_BASE}/generate-quiz` : 'http://127.0.0.1:5000/generate-quiz';
    const response = await axios.post(pythonUrl, form, { headers: form.getHeaders(), timeout: 180000 });

    let questions = (response.data && response.data.questions) || [];

    // If includeOptions false, strip options
    if (!includeOptions) {
      questions = questions.map(q => ({ text: q.question || q.text || '', options: [] }));
    } else {
      questions = questions.map(q => ({ text: q.question || q.text || '', options: q.options || [] }));
    }

    res.json({ questions });

    // REAL FILES ARE NOW SAVED (Cleanup removed)
    console.log(`Quiz extraction done. File saved in quizzes/ folder.`);

  } catch (err) {
    console.error('Error extracting questions:', err && err.message ? err.message : err);
    res.status(500).json({ error: 'Failed to extract questions', detail: err.message });
  }
});

module.exports = router;