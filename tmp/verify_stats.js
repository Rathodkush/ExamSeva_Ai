const axios = require('axios');

async function verify() {
    const API_URL = 'http://localhost:4000';

    try {
        console.log('Logging in as admin...');
        const loginRes = await axios.post(`${API_URL}/api/auth/login`, {
            email: 'admin@examseva.com',
            password: 'StrongAdminPass123'
        });

        const token = loginRes.data.token;
        console.log('Login successful. Token obtained.');

        console.log('Fetching statistics...');
        const statsRes = await axios.get(`${API_URL}/api/user/statistics`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log('Statistics Response:', JSON.stringify(statsRes.data, null, 2));

        if (statsRes.data.success) {
            console.log('SUCCESS: Statistics endpoint is functional.');
        } else {
            console.log('FAILURE: Statistics endpoint returned success: false');
        }

    } catch (err) {
        console.error('Verification failed:', err.response ? err.response.data : err.message);
    }
}

verify();
