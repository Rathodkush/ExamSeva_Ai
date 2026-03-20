const fs = require('fs');
const path = require('path');

const srcDir = 'c:/Users/ratho/OneDrive/Documents/document file/examseva 1.5/frontend/src';

const problematicStrings = [
  '``${process.env.REACT_APP_API_URL || `${process.env.REACT_APP_API_URL || "http://localhost:4000"}`"}`',
  '\'`${process.env.REACT_APP_API_URL || `${process.env.REACT_APP_API_URL || "http://localhost:4000"}`"}`\'',
  '"`${process.env.REACT_APP_API_URL || `${process.env.REACT_APP_API_URL || "http://localhost:4000"}`"}"',
  '`${process.env.REACT_APP_API_URL || "http://localhost:4000"}`' + "'", // For that one case in AdminLogin.jsx
];

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
  });
}

const targetReplacement = '`${process.env.REACT_APP_API_URL || "http://localhost:4000"}`';

walk(srcDir, (filePath) => {
  if (filePath.endsWith('.js') || filePath.endsWith('.jsx')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // Fix the double backtick variety
    content = content.split('``${process.env.REACT_APP_API_URL || `${process.env.REACT_APP_API_URL || "http://localhost:4000"}`"}`').join(targetReplacement);
    
    // Fix the quoted variety
    content = content.split('\'`${process.env.REACT_APP_API_URL || `${process.env.REACT_APP_API_URL || "http://localhost:4000"}`"}`\'').join(targetReplacement);
    
    // Fix AdminLogin specifically if it has that weird quote at the end
    // const response = await axios.post(`${process.env.REACT_APP_API_URL || "http://localhost:4000"}`/api/auth/login', credentials);
    content = content.split('`${process.env.REACT_APP_API_URL || "http://localhost:4000"}`/api/auth/login\'').join(targetReplacement + '/api/auth/login`');

    // Also look for: `${process.env.REACT_APP_API_URL || "http://localhost:4000"}`"}`
    content = content.replace(/(`\$\{process\.env\.REACT_APP_API_URL \|\| "[^"]+"\}`)"\}/g, "$1");

    if (content !== original) {
      console.log('Fixed:', filePath);
      fs.writeFileSync(filePath, content, 'utf8');
    }
  }
});
