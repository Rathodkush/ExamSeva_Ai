const fs = require('fs');
const path = require('path');

const srcDir = 'c:/Users/ratho/OneDrive/Documents/document file/examseva 1.5/frontend/src';

const bad1 = ' ``' + '${process.env.REACT_APP_API_URL || `${process.env.REACT_APP_API_URL || "http://localhost:4000"}`"}' + '` ';
const bad2 = ' \'`' + '${process.env.REACT_APP_API_URL || `${process.env.REACT_APP_API_URL || "http://localhost:4000"}`"}' + '`\' ';
const bad3 = ' `${process.env.REACT_APP_API_URL || "http://localhost:4000"}`';
const good = '`${process.env.REACT_APP_API_URL || "http://localhost:4000"}';

// Wait, literal string replacements without extra spaces.
const M_NESTED = '`${process.env.REACT_APP_API_URL || `${process.env.REACT_APP_API_URL || "http://localhost:4000"}`"}`';
const M_NESTED_BB = '``${process.env.REACT_APP_API_URL || `${process.env.REACT_APP_API_URL || "http://localhost:4000"}`"}`';
const M_NESTED_SQ = '\'`${process.env.REACT_APP_API_URL || `${process.env.REACT_APP_API_URL || "http://localhost:4000"}`"}`\'';
const M_SINGLE = '`${process.env.REACT_APP_API_URL || "http://localhost:4000"}`';

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

    content = content.split(M_NESTED_BB + '/').join(good + '/');
    content = content.split(M_NESTED_SQ + '/').join(good + '/');
    content = content.split(M_NESTED + '/').join(good + '/');
    
    // Fix simple corrupted ones: `${API}`/path'
    content = content.replace(/(`\$\{process\.env\.REACT_APP_API_URL \|\| "http:\/\/localhost:4000"\}\`)(\/)((?:api|static)\/[^'"`\s,)]+)(['"])/g, (match, m1, slash, path, quote) => {
      return '`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/' + path + '`';
    });

    if (content !== original) {
      console.log('Fixed:', filePath);
      fs.writeFileSync(filePath, content, 'utf8');
    }
  }
});
