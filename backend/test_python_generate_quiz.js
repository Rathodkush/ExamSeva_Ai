const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
(async ()=>{
  try {
    const filePath = './uploads/notes/185b50992519ca40061e48c44bbe1e57';
    if (!fs.existsSync(filePath)) { console.error('file missing'); process.exit(1); }
    const f = new FormData();
    f.append('files', fs.createReadStream(filePath), 'notes.pdf');
    f.append('metadata', JSON.stringify({ numberOfQuestions: 10 }));
    const resp = await axios.post('http://127.0.0.1:5000/generate-quiz', f, { headers: f.getHeaders(), timeout: 180000 });
    console.log('Python resp status:', resp.status);
    console.log('Resp data sample:', (resp.data && resp.data.questions && resp.data.questions.slice(0,2)) || resp.data);
  } catch (err) {
    console.error('Python call error:', {
      message: err.message,
      stack: err.stack,
      status: err.response && err.response.status,
      data: err.response && err.response.data
    });
    process.exit(1);
  }
})();