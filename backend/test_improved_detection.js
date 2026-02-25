/**
 * Test the improved repeated question detection
 * This creates a fresh test file to trigger new analysis
 */
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

// Create a fresh test file with clear repeated questions
const testContent = `
Question 1: What is velocity?
Answer: Velocity is the rate of change of position.

Question 2: Define velocity with proper explanation.
Answer: Velocity is the rate at which an object changes its position in a specific direction.

Question 3: How does velocity differ from speed?
Answer: Velocity has direction, speed does not.

Question 4: What is photosynthesis?
Answer: Photosynthesis is the process by which plants make their own food.

Question 5: Describe the photosynthesis process.
Answer: Plants use sunlight, water and carbon dioxide to produce glucose and oxygen.

Question 6: What is osmosis?
Answer: Osmosis is the movement of water across a semipermeable membrane.

Question 7: Define osmosis in biology.
Answer: Osmosis is the diffusion of water molecules from higher to lower concentration.

Question 8: What is ecosystem?
Answer: An ecosystem is a community of living organisms interacting with their environment.

Question 9: Define ecology.
Answer: Ecology is the study of organisms and their environment.

Question 10: Unique Question - What is the capital of France?
Answer: Paris.
`;

const testFile = './fresh_test_questions.txt';
fs.writeFileSync(testFile, testContent);

(async () => {
  try {
    console.log('🧪 Testing Improved Repeated Question Detection\n');
    console.log('Uploading fresh test file with CLEAR repeated questions...\n');
    
    const form = new FormData();
    form.append('files', fs.createReadStream(testFile), 'test_questions.txt');
    form.append('metadata', JSON.stringify({
      levelType: 'Board',
      classLevel: '10',
      year: '2024'
    }));

    const start = Date.now();
    const res = await axios.post('http://localhost:4000/api/upload', form, {
      headers: form.getHeaders(),
      timeout: 120000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    const time = Date.now() - start;
    
    if (res.data && res.data.groups) {
      console.log(`✅ Analysis completed in ${time}ms\n`);
      
      console.log(`📊 Results:`);
      console.log(`   Repeated Groups: ${res.data.groups.length}`);
      console.log(`   Unique Questions: ${res.data.unique?.length || 0}`);
      console.log(`   Total Variants: ${res.data.groups.reduce((sum, g) => sum + (g.members?.length || 0), 0)}`);
      
      if (res.data.groups.length > 0) {
        console.log(`\n✨ Repeated Groups Detected:`);
        res.data.groups.slice(0, 5).forEach((group, idx) => {
          console.log(`\n   Group ${idx + 1}: "${group.keywords?.slice(0, 3).join(', ') || 'Unknown'}"`);
          console.log(`   - Members: ${group.members?.length || 0}`);
          if (group.members) {
            group.members.forEach((m, midx) => {
              console.log(`     ${midx + 1}. ${m.text?.substring(0, 60)}...`);
            });
          }
        });
        console.log(`\n🎉 SUCCESS! Repeated questions are being detected!`);
      } else {
        console.log(`\n⚠️  No repeated groups found. Check logs.`);
      }
    } else {
      console.log(`❌ Invalid response:`, res.data);
    }
    
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    if (err.response?.data) {
      console.error('Details:', err.response.data);
    }
  }
})();
