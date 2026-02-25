const axios = require('axios');
const fs = require('fs');
(async ()=>{
  try{
    const token = process.env.TOKEN || '';
    const res = await axios.post('http://localhost:4000/api/analysis/report', {
      groups: [{ representative: 'What is photosynthesis?' }],
      unique: [{ text: 'Define osmosis.' }],
      metadata: { subject: 'Biology', semester: '6', academicYear: '2025' }
    }, { responseType: 'arraybuffer', headers: token ? { Authorization: `Bearer ${token}` } : {} });
    fs.writeFileSync('report.pdf', Buffer.from(res.data));
    console.log('Saved report.pdf');
  } catch(e){
    console.error('Report test failed:', e.response?.data || e.message);
  }
})();