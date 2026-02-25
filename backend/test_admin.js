const axios = require('axios');

async function testAdmin() {
  try {
    const login = await axios.post('http://localhost:4000/api/auth/login', {
      email: 'admin@examseva.com',
      password: 'StrongAdminPass123'
    }, { timeout: 10000 });
    console.log('Login success!', login.data);
  } catch (err) {
    if (err.response) {
      console.error('Login failed:', err.response.status, err.response.data);
    } else {
      console.error('Error:', err.message);
    }
  }
}
testAdmin();
