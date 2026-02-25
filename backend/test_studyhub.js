const axios = require('axios');
(async ()=>{
  try{
    // Register a temp user
    const email = `studyhub_test_${Date.now()}@example.com`;
    const reg = await axios.post('http://localhost:4000/api/auth/register', {
      fullName: 'StudyHub Tester',
      email,
      phone: '9876543210',
      password: 'secret123',
      confirmPassword: 'secret123',
      role: 'student',
      classStandard: '12',
      courseType: 'Science',
      year: '2025'
    }, { timeout: 10000 });
    console.log('registered', reg.data.success);
    const token = reg.data.token;
    // Call studyhub search
    const resp = await axios.post('http://localhost:4000/api/studyhub/search', { question: 'Define osmosis' }, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 20000
    });
    console.log('search resp:', resp.data);
  } catch(e){
    console.error('ERR', e.response ? e.response.data : e.message);
  }
})();