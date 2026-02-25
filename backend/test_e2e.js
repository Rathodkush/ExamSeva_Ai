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
    console.log('Uploading to /api/quiz/generate (JSON)...');
    const form = new FormData();
    form.append('file', fs.createReadStream(sample));
    form.append('numberOfQuestions', '5');
    form.append('subject', 'E2E Test Subject');

    const res = await axios.post('http://localhost:4000/api/quiz/generate', form, {
      headers: form.getHeaders(),
      timeout: 180000
    });

    console.log('Generate JSON response status:', res.status);
    if (!res.data || !res.data.success) {
      console.error('Generate JSON failed:', res.data || 'no body');
      process.exit(2);
    }

    console.log('Quiz generated with', (res.data.quiz && res.data.quiz.questions ? res.data.quiz.questions.length : 0), 'questions');

    console.log('Uploading to /api/quiz/generate_paper (PDF)...');
    const form2 = new FormData();
    form2.append('file', fs.createReadStream(sample));
    form2.append('numberOfQuestions', '5');
    form2.append('subject', 'E2E Test Subject');

    const res2 = await axios.post('http://localhost:4000/api/quiz/generate_paper', form2, {
      headers: form2.getHeaders(),
      responseType: 'arraybuffer',
      timeout: 180000
    });

    if (res2.status !== 200) {
      console.error('Generate paper failed, status:', res2.status);
      process.exit(3);
    }

    const out = path.join(__dirname, 'e2e_question_paper.pdf');
    fs.writeFileSync(out, Buffer.from(res2.data));
    const size = fs.statSync(out).size;
    console.log('Saved question paper to', out, 'size:', size);

    if (size < 100) {
      console.error('Output PDF too small — likely an error');
      process.exit(4);
    }

    console.log('E2E checks passed ✅');
    process.exit(0);
  } catch (err) {
    console.error('E2E test failed:', err.response?.data || err.message || err);
    process.exit(10);
  }
}

run();