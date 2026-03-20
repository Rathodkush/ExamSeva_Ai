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

const CLEAN_API = '${process.env.REACT_APP_API_URL || "http://localhost:4000"}';

walk(srcDir, (filePath) => {
  if (filePath.endsWith('.js') || filePath.endsWith('.jsx')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // 1. Remove outer quotes and backticks, then wrap nicely
    // This matches: [optional quote] ` ${API} / [path] [optional quote]
    // And collapses to: ` ${API} / [path] `
    
    // Fix start: replace ('`${API) with ( `${API)
    content = content.replace(/['"]+`\$\{process\.env\.REACT_APP_API_URL \|\| "http:\/\/localhost:4000"\}/g, '`${process.env.REACT_APP_API_URL || "http://localhost:4000"}');
    
    // Fix end: find where this template literal ends and ensure it has a ` before the closing punctuation
    // Example: .../api/notes' , credentials) -> .../api/notes` , credentials)
    // We only do this if it was started by our known API string.
    
    const API_PATTERN = '`${process.env.REACT_APP_API_URL || "http://localhost:4000"}';
    const splitArr = content.split(API_PATTERN);
    if (splitArr.length > 1) {
      for (let i = 1; i < splitArr.length; i++) {
        // splitArr[i] is like: /api/notes' , ...
        // We want to find the first quote and replace it with a backtick
        splitArr[i] = splitArr[i].replace(/^([^`', )]+)(['"]+)/, '$1`');
      }
      content = splitArr.join(API_PATTERN);
    }

    if (content !== original) {
      console.log('Fixed:', filePath);
      fs.writeFileSync(filePath, content, 'utf8');
    }
  }
});
