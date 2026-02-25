const axios = require('axios');
const fs = require('fs');
(async ()=>{
  try{
    const res = await axios.post('http://127.0.0.1:5000/generate_report', {
      groups: [{ representative: 'What is photosynthesis?' }],
      unique: [{ text: 'Define osmosis.' }],
      metadata: { subject: 'Biology', semester: '6', academicYear: '2025' }
    }, { responseType: 'arraybuffer' , timeout: 20000});
    fs.writeFileSync('py_report.pdf', Buffer.from(res.data));
    console.log('Saved py_report.pdf');
  } catch(e){
    console.error('Python report test failed:', e.response?.data || e.message);
  }
})();