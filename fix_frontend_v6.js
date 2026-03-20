const fs = require('fs');
const path = require('path');

const srcDir = 'c:/Users/ratho\OneDrive/Documents/document file/examseva 1.5/frontend/src';

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
  });
}

const CLEAN_BLOCK = '`${process.env.REACT_APP_API_URL || "http://localhost:4000"}';

walk(srcDir, (filePath) => {
  if (filePath.endsWith('.js') || filePath.endsWith('.jsx')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // VERY AGGRESSIVE: Match anything that starts with some delimiter and has the API URL pattern inside
    // through any combination of closing characters followed by a slash or another delimiter
    
    // Pattern matches: [quotes/backticks]* ${ [anything with REACT_APP_API_URL] } [quotes/backticks/$3/garbage]*
    content = content.replace(/[`'"]*\$\{process\.env\.REACT_APP_API_URL[^}]*?http:\/\/localhost:4000[^}]*?\}[^`', )]*(\$3)?/g, CLEAN_BLOCK + '`');
    
    // Fix double backticks that may emerge at the start or end
    content = content.replace(/(`+)(\$\{process\.env\.REACT_APP_API_URL)/g, '`$2');
    
    // Fix double backticks at the end of the URL block
    content = content.replace(/("http:\/\/localhost:4000"\}`)(`+)/g, '$1');

    // Fix the specific case of path endings like /path`' etc
    content = content.replace(/(\$\{process\.env\.REACT_APP_API_URL\s*\|\|\s*"http:\/\/localhost:4000"\}\/[^'`, )]+)([`'"]+)(?=[, )]|\s*;)/g, '$1`');

    if (content !== original) {
      console.log('Fixed:', filePath);
      fs.writeFileSync(filePath, content, 'utf8');
    }
  }
});
