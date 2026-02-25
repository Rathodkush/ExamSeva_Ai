/**
 * Direct upload test - POST a file to /api/upload without going through frontend
 * This helps isolate whether issue is in the frontend request construction or backend
 */
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

(async () => {
  try {
    // Use the repeated questions test file
    const testFile = 'C:\\Users\\ratho\\OneDrive\\Documents\\document file\\examseva 1.2\\backend\\test_repeated_questions.txt';
    
    if (!fs.existsSync(testFile)) {
      console.error("Test file not found:", testFile);
      process.exit(1);
    }

    console.log('Creating FormData with test file...');
    const form = new FormData();
    
    // Append file with field name 'files' (array)
    form.append('files', fs.createReadStream(testFile), 'test_variants_multiline.txt');
    
    // Append metadata JSON
    const metadata = {
      levelType: 'Board',
      institutionName: 'Test School',
      state: 'Test State',
      classLevel: '10th',
      degreeName: '',
      semester: '',
      year: '2024',
      subject: 'General'
    };
    form.append('metadata', JSON.stringify(metadata));

    console.log('\nPOSTing to http://localhost:4000/api/upload...');
    console.log('FormData includes:');
    console.log('  - files: test_repeated_questions.txt');
    console.log('  - metadata:', metadata);

    const response = await axios.post('http://localhost:4000/api/upload', form, {
      headers: form.getHeaders(),
      timeout: 30000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    console.log('\n✓ Upload succeeded!');
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));

  } catch (err) {
    console.error('\n✗ Upload failed');
    console.error('Error message:', err.message);
    if (err.response) {
      console.error('Response status:', err.response.status);
      console.error('Response data:', JSON.stringify(err.response.data, null, 2));
    } else if (err.code) {
      console.error('Error code:', err.code);
    }
    process.exit(1);
  }
})();
