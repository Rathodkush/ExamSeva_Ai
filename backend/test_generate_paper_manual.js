const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

(async () => {
  try {
    // choose a sample notes file from uploads/notes
    const filePath = './uploads/notes/185b50992519ca40061e48c44bbe1e57';
    if (!fs.existsSync(filePath)) {
      console.log('Sample notes file not found:', filePath);
      process.exit(1);
    }

    const f = new FormData();
    f.append('file', fs.createReadStream(filePath));

    console.log('Calling /api/exam/detect...');
    const detect = await axios.post('http://localhost:4000/api/exam/detect', f, { headers: f.getHeaders(), timeout: 120000 });
    console.log('Detect response:', detect.data);

    // Now attempt to generate paper using detected metadata
    const fd = new FormData();
    fd.append('file', fs.createReadStream(filePath));
    fd.append('mode', (detect.data.detected && detect.data.detected.mode) || 'school');
    fd.append('classLevel', (detect.data.detected && detect.data.detected.classLevel) || '10');
    fd.append('numberOfQuestions', '10');

    console.log('Calling /api/quiz/generate_paper (this will return a PDF)...');
    const res = await axios.post('http://localhost:4000/api/quiz/generate_paper', fd, { headers: fd.getHeaders(), responseType: 'arraybuffer', timeout: 180000 });
    if (res.status === 200) {
      console.log('Received PDF. Saving to temp_question_paper.pdf');
      fs.writeFileSync('temp_question_paper.pdf', res.data);
      console.log('Saved temp_question_paper.pdf');
    } else {
      console.log('Unexpected status:', res.status, res.data);
    }
  } catch (err) {
    console.error('Test error details:', {
      message: err.message,
      stack: err.stack,
      responseStatus: err.response && err.response.status,
      responseData: err.response && err.response.data
    });
    process.exit(1);
  }
})();