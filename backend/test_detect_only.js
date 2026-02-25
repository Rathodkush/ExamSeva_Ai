const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
(async () => {
  try {
    const filePath = './uploads/notes/185b50992519ca40061e48c44bbe1e57';
    if (!fs.existsSync(filePath)) {
      console.error('Test file not found:', filePath); process.exit(1);
    }
    const f = new FormData();
    f.append('file', fs.createReadStream(filePath));
    const resp = await axios.post('http://localhost:4000/api/exam/detect', f, { headers: f.getHeaders(), timeout: 120000 });
    console.log('Detect OK:', resp.status, resp.data);
  } catch (err) {
    console.error('Detect error:', {
      message: err.message,
      status: err.response && err.response.status,
      data: err.response && err.response.data,
      stack: err.stack
    });
    process.exit(1);
  }
})();