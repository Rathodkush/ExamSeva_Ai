const fs = require('fs');
const path = require('path');

const srcDir = 'c:/Users/ratho/OneDrive/Documents/document file/examseva 1.5/frontend/src';

const problematicParts = [
  '``${process.env.REACT_APP_API_URL || `${process.env.REACT_APP_API_URL || "http://localhost:4000"}`"}`',
  '\'`${process.env.REACT_APP_API_URL || `${process.env.REACT_APP_API_URL || "http://localhost:4000"}`"}`\'',
  '"`${process.env.REACT_APP_API_URL || `${process.env.REACT_APP_API_URL || "http://localhost:4000"}`"}"',
  '`${process.env.REACT_APP_API_URL || "http://localhost:4000"}`'
];

const targetReplacement = '`${process.env.REACT_APP_API_URL || "http://localhost:4000"}`';

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
  });
}

walk(srcDir, (filePath) => {
  if (filePath.endsWith('.js') || filePath.endsWith('.jsx')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // Fix the nested double-backtick recursive mess
    content = content.split('``${process.env.REACT_APP_API_URL || `${process.env.REACT_APP_API_URL || "http://localhost:4000"}`"}`').join(targetReplacement);
    content = content.split('\'`${process.env.REACT_APP_API_URL || `${process.env.REACT_APP_API_URL || "http://localhost:4000"}`"}`\'').join(targetReplacement);
    
    // Fix AdminLogin.jsx specifically if it looks like post(`${API}`/path', ...)
    content = content.replace(/axios\.(post|get|put|delete|patch|request)\(([`'])\$\{process\.env\.REACT_APP_API_URL \|\| "http:\/\/localhost:4000"\}\1(?:\+ ?)?\/api\/([^'`,]+?)(['"])/g, 
                             (match, method, q1, path, q2) => {
                               return `axios.${method}(\`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/api/${path}\``;
                             });

    // Fix literal: `${API}`/path'
    content = content.split('`${process.env.REACT_APP_API_URL || "http://localhost:4000"}`/').join('`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/');
    
    // Fix end quote/backtick mismatch
    // If we have `${API}/path', change it to template literal
    content = content.replace(/(\$\{process\.env\.REACT_APP_API_URL \|\| "http:\/\/localhost:4000"\}\/api\/[^'`, ]+)(['"])/g, "$1`$2");
    
    // Actually, I'll just restore the original commit from git log if possible?
    // No, I'll fix this manually.

    if (content !== original) {
      console.log('Fixed:', filePath);
      fs.writeFileSync(filePath, content, 'utf8');
    }
  }
});
