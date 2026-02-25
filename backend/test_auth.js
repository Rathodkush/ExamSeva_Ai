const axios = require('axios');

async function test() {
  try {
    console.log('Testing /api/auth/register');
    const reg = await axios.post('http://localhost:4000/api/auth/register', {
      fullName: 'Test User',
      email: 'testuser+1@example.com',
      phone: '9876543210',
      password: 'secret123',
      confirmPassword: 'secret123',
      role: 'student',
      classStandard: '12',
      courseType: 'Science',
      year: '2025'
    }, { timeout: 10000 });
    console.log('Register response status:', reg.status);
    console.log(reg.data);

    console.log('\nTesting /api/auth/login');
    const login = await axios.post('http://localhost:4000/api/auth/login', {
      email: 'testuser+1@example.com',
      password: 'secret123'
    }, { timeout: 10000 });
    console.log('Login response status:', login.status);
    console.log(login.data);
  } catch (err) {
    if (err.response) {
      console.error('Error response:', err.response.status, err.response.data);
    } else if (err.request) {
      console.error('No response received. Request details:', err.code || err.message);
    } else {
      console.error('Axios error:', err.message);
    }
    console.error(err.stack || 'no stack');
  }
}

test();
