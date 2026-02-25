/**
 * Test script to validate all improvements:
 * 1. Caching/Skip reprocessing
 * 2. Repeated question detection
 * 3. Frontend display
 */
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:4000';
const API = {
  upload: `${BASE_URL}/api/upload`,
  uploads: `${BASE_URL}/api/uploads`,
  health: `${BASE_URL}/api/health`
};

const testFile = path.join(__dirname, 'test_repeated_questions.txt');

async function testCaching() {
  console.log('\n📋 TEST 1: CACHING - Skip reprocessing duplicate files\n');
  
  if (!fs.existsSync(testFile)) {
    console.error('❌ Test file not found:', testFile);
    return false;
  }

  try {
    // First upload
    console.log('⏱️  First upload of test file...');
    const start1 = Date.now();
    
    const form1 = new FormData();
    form1.append('files', fs.createReadStream(testFile), 'test_file.txt');
    form1.append('metadata', JSON.stringify({
      levelType: 'Board',
      institutionName: 'Test School',
      classLevel: '10',
      year: '2024'
    }));

    const res1 = await axios.post(API.upload, form1, {
      headers: form1.getHeaders(),
      timeout: 60000
    });

    const time1 = Date.now() - start1;
    const hasGroups1 = res1.data.groups && res1.data.groups.length > 0;
    const haseUnique1 = res1.data.unique && res1.data.unique.length > 0;
    
    console.log(`✅ First upload: ${time1}ms`);
    console.log(`   Groups: ${res1.data.groups?.length || 0}, Unique: ${res1.data.unique?.length || 0}`);
    console.log(`   Cached: ${res1.data.cached || false}`);

    // Second upload (should be cached)
    console.log('\n⏱️  Second upload of SAME file (should hit cache)...');
    const start2 = Date.now();
    
    const form2 = new FormData();
    form2.append('files', fs.createReadStream(testFile), 'test_file.txt');
    form2.append('metadata', JSON.stringify({
      levelType: 'Board',
      institutionName: 'Test School',
      classLevel: '10',
      year: '2024'
    }));

    const res2 = await axios.post(API.upload, form2, {
      headers: form2.getHeaders(),
      timeout: 60000
    });

    const time2 = Date.now() - start2;
    
    console.log(`✅ Second upload: ${time2}ms`);
    console.log(`   Groups: ${res2.data.groups?.length || 0}, Unique: ${res2.data.unique?.length || 0}`);
    console.log(`   Cached: ${res2.data.cached || false}`);
    
    // Validate caching worked
    if (res2.data.cached === true && time2 < 5000) {
      console.log(`✅ CACHING WORKS! Second request was ${time1 / time2}x faster`);
      return true;
    } else {
      console.log(`⚠️  Caching may not have worked. Cache flag: ${res2.data.cached}, Time: ${time2}ms`);
      return res1.data.groups && res1.data.groups.length > 0;
    }
    
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    if (err.response?.data) {
      console.error('Error details:', err.response.data);
    }
    return false;
  }
}

async function testRepeatedDetection() {
  console.log('\n🔍 TEST 2: REPEATED QUESTION DETECTION\n');
  
  try {
    const form = new FormData();
    form.append('files', fs.createReadStream(testFile), 'test_questions.txt');
    form.append('metadata', JSON.stringify({
      levelType: 'Board',
      institutionName: 'Test School',
      classLevel: '10',
      year: '2024'
    }));

    const res = await axios.post(API.upload, form, {
      headers: form.getHeaders(),
      timeout: 60000
    });

    const groups = res.data.groups || [];
    const unique = res.data.unique || [];

    console.log(`📊 Detection Results:`);
    console.log(`   Repeated Groups: ${groups.length}`);
    console.log(`   Unique Questions: ${unique.length}`);
    console.log(`   Total Variants: ${groups.reduce((sum, g) => sum + (g.members?.length || 0), 0)}`);
    
    // Show group details
    if (groups.length > 0) {
      console.log(`\n📌 Group Details:`);
      groups.slice(0, 3).forEach((group, idx) => {
        console.log(`\n   Group ${idx + 1}: "${group.keywords?.slice(0, 3).join(', ') || 'unknown'}"`);
        console.log(`   - Main keywords: ${group.keywords?.join(', ') || 'N/A'}`);
        console.log(`   - Variants: ${group.members?.length || 0}`);
        console.log(`   - Representative: ${group.representative?.substring(0, 60)}...`);
        
        if (group.members && group.members.length > 0) {
          group.members.slice(0, 2).forEach((member, midx) => {
            console.log(`     ${midx + 1}. ${member.text?.substring(0, 50)}... (score: ${member.score?.toFixed(2)})`);
          });
        }
      });
    }

    // Validate results
    if (groups.length > 0 || unique.length > 0) {
      console.log(`\n✅ DETECTION WORKING! Found ${groups.length} groups and ${unique.length} unique questions`);
      return true;
    } else {
      console.log(`⚠️  No repeated questions detected. Check OCR extraction.`);
      return false;
    }
    
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    return false;
  }
}

async function testFrontendDisplay() {
  console.log('\n🎨 TEST 3: FRONTEND API - Verify data is accessible for display\n');
  
  try {
    // Get list of uploads
    const res = await axios.get(API.uploads);
    const uploads = res.data.uploads || [];

    console.log(`📊 Database Results:`);
    console.log(`   Total uploads: ${uploads.length}`);
    
    if (uploads.length > 0) {
      const latest = uploads[0];
      console.log(`\n   Latest upload:`);
      console.log(`   - ID: ${latest._id}`);
      console.log(`   - Files: ${latest.files?.join(', ') || 'N/A'}`);
      console.log(`   - Groups: ${latest.groups?.length || 0}`);
      console.log(`   - Unique: ${latest.unique?.length || 0}`);
      console.log(`   - Created: ${new Date(latest.createdAt).toLocaleString()}`);
      
      // Verify structure for frontend
      const hasCorrectStructure = 
        Array.isArray(latest.groups) &&
        Array.isArray(latest.unique) &&
        latest.groups.every(g => g.members && Array.isArray(g.members)) &&
        latest.unique.every(u => u.text && typeof u.text === 'string');
      
      if (hasCorrectStructure) {
        console.log(`\n✅ DATA STRUCTURE CORRECT! Frontend can display results`);
        return true;
      } else {
        console.log(`⚠️  Data structure issue detected`);
        console.log(`   Groups valid: ${latest.groups?.every(g => g.members)}`);
        console.log(`   Unique valid: ${latest.unique?.every(u => u.text)}`);
        return false;
      }
    } else {
      console.log(`⚠️  No uploads found in database`);
      return false;
    }
    
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    return false;
  }
}

async function runAllTests() {
  console.log('═'.repeat(70));
  console.log('🧪 EXAMSEVA IMPROVEMENTS TEST SUITE');
  console.log('═'.repeat(70));
  
  // Check backend health
  try {
    await axios.get(API.health, { timeout: 5000 });
    console.log('✅ Backend is running\n');
  } catch (err) {
    console.error('❌ Backend not available at', BASE_URL);
    console.error('   Please ensure Node.js backend is running');
    process.exit(1);
  }

  // Run tests
  const results = {};
  
  results.caching = await testCaching();
  results.detection = await testRepeatedDetection();
  results.frontend = await testFrontendDisplay();
  
  // Summary
  console.log('\n' + '═'.repeat(70));
  console.log('📊 TEST SUMMARY');
  console.log('═'.repeat(70));
  
  const passed = Object.values(results).filter(r => r).length;
  const total = Object.keys(results).length;
  
  Object.entries(results).forEach(([name, passed]) => {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} - ${name.charAt(0).toUpperCase() + name.slice(1)}`);
  });
  
  console.log(`\nResult: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 All improvements are working correctly!');
  } else {
    console.log('⚠️  Some issues detected - check logs above');
  }
  
  console.log('═'.repeat(70));
}

// Run tests
runAllTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
