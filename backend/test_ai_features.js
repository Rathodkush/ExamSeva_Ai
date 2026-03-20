const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const API_URL = 'http://localhost:4000';
let token = '';
let uploadId = '';

async function testAI() {
    console.log('🤖 Starting AI Features Verification...\n');

    try {
        // 1. LOGIN
        const loginRes = await axios.post(`${API_URL}/api/auth/login`, {
            email: 'admin@examseva.com',
            password: 'StrongAdminPass123'
        });
        token = loginRes.data.token;
        console.log('   Login successful');

        // 2. UPLOAD & PROCESS
        console.log('\n--- Phase 1: Upload & Clustering ---');
        const form = new FormData();
        form.append('levelType', 'Semester 1');
        form.append('institutionName', 'Test University');
        form.append('state', 'Maharashtra');
        form.append('classLevel', 'FE');
        form.append('degreeName', 'Computer Science');
        form.append('subject', 'Physics');
        form.append('year', '2023');

        const pdfPath = path.join(__dirname, 'paper_test.pdf');
        if (!fs.existsSync(pdfPath)) {
            console.error('❌ paper_test.pdf found at:', pdfPath);
            return;
        }

        form.append('files', fs.createReadStream(pdfPath));
        // Simulate uploading the same file twice to trigger clustering logic
        form.append('files', fs.createReadStream(pdfPath));

        console.log('⏳ Uploading and processing (this may take a while)...');
        const uploadRes = await axios.post(`${API_URL}/api/upload`, form, {
            headers: {
                ...form.getHeaders(),
                Authorization: `Bearer ${token}`
            },
            timeout: 120000 // 2 minutes
        });

        if (uploadRes.data.success) {
            uploadId = uploadRes.data.uploadId;
            console.log('   Processing successful');
            console.log('📊 Result summary:', {
                groupsCount: uploadRes.data.groupsCount,
                uniqueCount: uploadRes.data.uniqueCount,
                totalExtracted: uploadRes.data.totalExtracted
            });
        } else {
            console.error('❌ Processing failed:', uploadRes.data.error);
            return;
        }

        // 3. REPORT GENERATION
        console.log('\n--- Phase 2: Report Generation ---');
        try {
            const reportPayload = {
                groups: uploadRes.data.groups || [],
                unique: uploadRes.data.unique || [],
                metadata: { subject: 'Physics', institution: 'Test University' }
            };
            const reportRes = await axios.post(`${API_URL}/api/analysis/report`, reportPayload, {
                responseType: 'arraybuffer',
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log('   PDF Analysis Report: Success (Received ' + reportRes.data.byteLength + ' bytes)');
        } catch (e) {
            console.error('❌ PDF Report failed:', e.message);
        }

        // 4. QUIZ GENERATION (Phase 3)
        console.log('\n--- Phase 3: Quiz Generation ---');
        try {
            const quizForm = new FormData();
            quizForm.append('file', fs.createReadStream(pdfPath));
            quizForm.append('subject', 'Physics');
            quizForm.append('numberOfQuestions', '5');

            const quizRes = await axios.post(`${API_URL}/api/quiz/generate`, quizForm, {
                headers: {
                    ...quizForm.getHeaders(),
                    Authorization: `Bearer ${token}`
                },
                timeout: 180000
            });
            if (quizRes.data.success || quizRes.data.quiz) {
                console.log('   Quiz Generation: Success');
                const quizData = quizRes.data.quiz || quizRes.data;
                console.log('📝 Questions count:', quizData.questions?.length || 0);

                // 5. SCORE SUBMISSION (Phase 4)
                console.log('\n--- Phase 4: Score Submission ---');
                const scoreRes = await axios.post(`${API_URL}/api/quiz/score`, {
                    score: 4,
                    totalQuestions: 5
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                console.log('   Score Submission: Success (ID: ' + scoreRes.data.quizScore?._id + ')');
            } else {
                console.error('❌ Quiz Generation failed:', quizRes.data.error);
            }
        } catch (e) {
            console.error('❌ Quiz Generation Request failed:', e.response?.data?.error || e.message);
        }

        console.log('\n🏁 AI Features Verification Completed!');

    } catch (error) {
        console.error('\n❌ AI Features Verification Failed!');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data));
        } else {
            console.error('Error:', error.message);
        }
    }
}

testAI();
