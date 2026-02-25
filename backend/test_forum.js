const axios = require('axios');

async function run() {
  try {
    const base = 'http://localhost:4000';
    const email = `forum_test_${Date.now()}@example.com`;

    console.log('Registering user:', email);
    const reg = await axios.post(base + '/api/auth/register', {
      fullName: 'Forum Tester',
      email,
      phone: '9876543210',
      password: 'secret123',
      confirmPassword: 'secret123',
      role: 'student',
      classStandard: '12',
      courseType: 'Science',
      year: '2025'
    }, { timeout: 10000 });
    console.log('Register response:', reg.status, reg.data.success ? 'success' : 'failed');

    const token = reg.data.token;
    if (!token) {
      console.error('No token returned during registration; aborting');
      return;
    }

    console.log('Posting forum post...');
    const postRes = await axios.post(base + '/api/forum/posts', {
      title: 'Test Post from Automated Script',
      content: 'This is a test post to verify forum posting works.'
    }, { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 });

    console.log('Post response status:', postRes.status);
    console.log('Post response body:', postRes.data);
  } catch (err) {
    if (err.response) {
      console.error('Error response:', err.response.status, err.response.data);
    } else if (err.request) {
      console.error('No response received:', err.code || err.message);
    } else {
      console.error('Request error:', err.message);
    }
    console.error(err.stack || 'no stack');
  }
}

run();
