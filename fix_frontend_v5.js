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

const CLEAN_API_START = '`${process.env.REACT_APP_API_URL || "http://localhost:4000"}';

walk(srcDir, (filePath) => {
  if (filePath.endsWith('.js') || filePath.endsWith('.jsx')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // 1. Fix the recursive mess and $3 garbage
    // This regex looks for anything that looks like our corrupted API URL part and collapses it to the clean start.
    // It matches from any opening quote/backtick sequence through "http://localhost:4000" and any following corrupted closing characters.
    content = content.replace(/[`'"]*\$\{process\.env\.REACT_APP_API_URL[^}]*?http:\/\/localhost:4000[^}]*?\}[^/]*\//g, CLEAN_API_START + '/');
    
    // 2. Fix cases where it didn't have a slash immediately after, or had $3
    content = content.replace(/[`'"]*\$\{process\.env\.REACT_APP_API_URL[^}]*?http:\/\/localhost:4000[^}]*?\}[^`',)]*(\$3)?/g, CLEAN_API_START + '`');

    // 3. Fix cases where we now have double backticks like `${API}/path``
    content = content.replace(/(\$\{process\.env\.REACT_APP_API_URL \|\| "http:\/\/localhost:4000"\}\/[^`',)]+?)`{2,}/g, '$1`');

    // 4. Fix specific mismatched endings like /path`' or /path`" or /path`$3
    content = content.replace(/(\$\{process\.env\.REACT_APP_API_URL \|\| "http:\/\/localhost:4000"\}\/[^`',)]+?)[`'"]+(\$3)?/g, '$1`');

    if (content !== original) {
      console.log('Fixed:', filePath);
      fs.writeFileSync(filePath, content, 'utf8');
    }
  }
});
