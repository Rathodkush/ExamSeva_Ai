const axios = require('axios');

async function testForgotPassword() {
    try {
        const response = await axios.post('http://localhost:  4001/api/auth/forgot-password', {
            email: 'test@example.com'
        });
        console.log('Response status:', response.status);
        console.log('Response data:', response.data);
        if (response.data.resetToken || response.data.resetPasswordToken) {
            console.error('FAIL: Password reset token was leaked in response!');
        } else {
            console.log('SUCCESS: No password reset token found in response.');
        }
    } catch (err) {
        if (err.response) {
            console.log('Response data (error):', err.response.data);
            if (err.response.data.resetToken || err.response.data.resetPasswordToken) {
                console.error('FAIL: Password reset token was leaked in error response!');
            } else {
                console.log('SUCCESS: No password reset token found in error response.');
            }
        } else {
            console.error('Error connecting to server:', err.message);
            console.log('Verification skipped: Ensure server is running at http://localhost:  4001');
        }
    }
}

testForgotPassword();
