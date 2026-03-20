const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const API_URL = 'http://localhost:4000';
let studentToken = '';
let adminToken = '';
let testNoteId = '';
let testPaperId = '';

async function runTests() {
    console.log('🚀 Starting Final E2E Test Suite...\n');

    try {
        // 1. AUTHENTICATION
        console.log('--- Phase 1: Authentication ---');

        // a. Register a test student
        const studentEmail = `student_${Date.now()}@test.com`;
        const regRes = await axios.post(`${API_URL}/api/auth/register`, {
            fullName: 'Test Student',
            email: studentEmail,
            phone: '1234567890',
            password: 'password123',
            confirmPassword: 'password123',
            role: 'student',
            classStandard: '12th',
            courseType: 'Science',
            year: '2024'
        });
        console.log('   Student Registration: Success');
        studentToken = regRes.data.token;

        // b. Login Admin
        // Using default credentials from server.js
        const adminLoginRes = await axios.post(`${API_URL}/api/auth/login`, {
            email: 'admin@examseva.com',
            password: 'StrongAdminPass123'
        });
        console.log('   Admin Login: Success');
        adminToken = adminLoginRes.data.token;

        // 2. USER MANAGEMENT (Admin)
        console.log('\n--- Phase 2: User Management ---');
        const usersRes = await axios.get(`${API_URL}/api/admin/users`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        console.log(`   Admin Fetch Users: Found ${usersRes.data.users.length} users`);

        // 3. STUDY HUB
        console.log('\n--- Phase 3: Study Hub ---');

        // a. Admin uploads a question paper
        const paperForm = new FormData();
        paperForm.append('title', 'E2E Test Paper');
        paperForm.append('subject', 'Physics');
        paperForm.append('visibility', 'free');
        const pdfPath = path.join(__dirname, 'paper_test.pdf');
        if (fs.existsSync(pdfPath)) {
            paperForm.append('file', fs.createReadStream(pdfPath));
            const uploadPaperRes = await axios.post(`${API_URL}/api/admin/question-papers`, paperForm, {
                headers: {
                    ...paperForm.getHeaders(),
                    Authorization: `Bearer ${adminToken}`
                }
            });
            console.log('   Admin Upload Paper: Success');
            testPaperId = uploadPaperRes.data.paper._id;
        } else {
            console.warn('⚠️ paper_test.pdf not found, skipping admin upload test');
        }

        // b. Fetch papers (Admin)
        const papersRes = await axios.get(`${API_URL}/api/admin/question-papers`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        console.log(`   Admin Fetch Papers: Found ${papersRes.data.papers.length} papers`);

        // c. Student uploads a note
        const noteForm = new FormData();
        noteForm.append('name', 'E2E Test Note');
        noteForm.append('subject', 'Chemistry');
        noteForm.append('description', 'Test description');
        if (fs.existsSync(pdfPath)) {
            noteForm.append('file', fs.createReadStream(pdfPath));
            const uploadNoteRes = await axios.post(`${API_URL}/api/notes`, noteForm, {
                headers: {
                    ...noteForm.getHeaders(),
                    Authorization: `Bearer ${studentToken}`
                }
            });
            console.log('   Student Upload Note: Success');
            testNoteId = uploadNoteRes.data.note._id;
        }

        // 4. FORUM
        console.log('\n--- Phase 4: Forum ---');
        const postRes = await axios.post(`${API_URL}/api/forum/posts`, {
            title: 'How to prepare for Physics?',
            content: 'Any tips?',
            category: 'Exam Tips'
        }, {
            headers: { Authorization: `Bearer ${studentToken}` }
        });
        console.log('   Student Create Post: Success');
        const postId = postRes.data.post._id;

        // Admin deletes the post
        await axios.delete(`${API_URL}/api/admin/forum/posts/${postId}`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        console.log('   Admin Delete Post: Success');

        // 5. STATISTICS
        console.log('\n--- Phase 5: Statistics ---');
        const statsRes = await axios.get(`${API_URL}/api/user/statistics`, {
            headers: { Authorization: `Bearer ${studentToken}` }
        });
        console.log('   Student Stats:', JSON.stringify(statsRes.data.statistics));

        if (statsRes.data.statistics.papersUploaded >= 1) {
            console.log('   Stats Check: Correctly counted the note upload');
        } else {
            console.warn('❌ Stats Check: Papers uploaded count mismatch');
        }

        console.log('\n🏁 E2E Test Suite Completed Successfully!');

    } catch (error) {
        console.error('\n❌ E2E Test Suite Failed!');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data));
        } else {
            console.error('Error:', error.message);
        }
    }
}

runTests();
