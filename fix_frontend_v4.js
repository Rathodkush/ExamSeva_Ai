const fs = require('fs');
const path = require('path');

const srcDir = 'c:/Users/ratho/OneDrive/Documents/document file/examseva 1.5/frontend/src';

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
  });
}

const targetReplacement = '`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/';

walk(srcDir, (filePath) => {
  if (filePath.endsWith('.js') || filePath.endsWith('.jsx')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // Replace the mess at the start of the path
    // Match any combination of backticks or quotes, followed by ${...api...}, followed by any ending quotes/braces and a slash
    // Regex matches: [`'"]* \$\{...API...\} [^/]* /
    content = content.replace(/[`'"]*\$\{process\.env\.REACT_APP_API_URL\s*\|\|\s*(?:`\$\{process\.env\.REACT_APP_API_URL\s*\|\|\s*"http:\/\/localhost:4000"\}`|"[^"]+")\s*\}[^/]*\//g, targetReplacement);
    
    // After that, we might have mismatched ends like /path` or /path' or /path`'
    // We want /path`
    // Regex matches: / [chars] [wrong quotes] [,)]
    // We'll do this more carefully.
    
    // Fix: /api/something' -> /api/something`
    // Fix: /api/something`' -> /api/something`
    // Fix: /api/something"` -> /api/something`
    
    // Look for occurrences of our clean replacement and fix the corresponding tail
    const segments = content.split(targetReplacement);
    if (segments.length > 1) {
      for (let i = 1; i < segments.length; i++) {
        // segment[i] is the path part like: api/auth/login`' , credentials)
        // or: api/admin/announcements/${id}`, {
        
        // Find the first occurrence of ` or ' or " that is followed by a comma, closing paren, or end of line
        // and replace everything from that quote to the next safe delimiter with a single `
        segments[i] = segments[i].replace(/^([^`',)]+)([`'"]+)(?=[,)]|\s*;)/, "$1`$3");
      }
      content = segments.join(targetReplacement);
    }

    if (content !== original) {
      console.log('Fixed:', filePath);
      fs.writeFileSync(filePath, content, 'utf8');
    }
  }
});
