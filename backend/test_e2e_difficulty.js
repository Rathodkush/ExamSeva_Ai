const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

async function run() {
  const sample = path.join(__dirname, 'py_report.pdf');
  if (!fs.existsSync(sample)) {
    console.error('Sample file not found:', sample);
    process.exit(1);
  }

  try {
    console.log('Uploading to /api/quiz/generate with difficulty/ocr...');
    const form = new FormData();
    form.append('file', fs.createReadStream(sample));
    form.append('numberOfQuestions', '6');
    form.append('subject', 'Difficulty Test');
    form.append('difficultyOrder', 'mixed');
    form.append('forceOcr', 'false');

    const res = await axios.post('http://localhost:4000/api/quiz/generate', form, { headers: form.getHeaders(), timeout: 180000 });
    console.log('Status:', res.status);
    if (!res.data.success) {
      console.error('Failed:', res.data);
      process.exit(2);
    }

    const meta = res.data.quiz.metadata || {};
    console.log('Metadata returned:', meta);
    if (!meta.difficultyOrder) {
      console.error('Missing difficultyOrder in metadata');
      process.exit(3);
    }

    console.log('Done ✅');
    process.exit(0);
  } catch (err) {
    console.error('Test failed:', err.response?.data || err.message || err);
    process.exit(10);
  }
}

run();