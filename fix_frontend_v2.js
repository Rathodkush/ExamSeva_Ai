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

const cleanApiPart = '`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/';

walk(srcDir, (filePath) => {
  if (filePath.endsWith('.js') || filePath.endsWith('.jsx')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // This regex looks for any weird combination of quotes/backticks around the API part and a following slash
    // and collapses it into `${process.env.REACT_APP_API_URL || "http://localhost:4000"}/
    
    // Pattern: [quote/backtick]+${...}[any closing chars including quotes]/
    content = content.replace(/[`'"]*\$\{process\.env\.REACT_APP_API_URL\s*\|\|\s*(?:`\$\{process\.env\.REACT_APP_API_URL\s*\|\|\s*"http:\/\/localhost:4000"\}`|"[^"]+")\s*\}[^/]*\//g, cleanApiPart);
    
    // Also clean up any accidental double backticks at the end of the template literal if they exist
    // like /path` results after the above replace
    // Actually the above replace only fixes the beginning part.
    
    // If it was axios.get(`${API}`/path`, then it becomes axios.get(`${API}/path` - correct
    // If it was axios.get('`${API}`/path', then it becomes axios.get(`${API}/path' - still need to fix the end quote
    
    // Fix common end quotes
    content = content.replace(/\/([^'"`\s,)]+)(['"])(?=[,)]|\s*;)/g, "/$1`$3");
    
    // Wait, simpler: I'll just restore the whole files from the repo first, and then apply a FIXED patch if needed.
    // But I already ran git restore . and it BROUGHT THESE ERRORS?
    // This means the errors exist in the git repo's current commit (1149778).
    
    // Let's use a very specific single-line fix for the most common pattern found in my view_file output.
    // From AdminAnnouncements: `${process.env.REACT_APP_API_URL || "http://localhost:4000"}`/api/admin/announcements/${editingAnnouncement._id}`
    // We want: `${process.env.REACT_APP_API_URL || "http://localhost:4000"}/api/admin/announcements/${editingAnnouncement._id}`
    
    content = content.split('`${process.env.REACT_APP_API_URL || "http://localhost:4000"}`/').join('`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/');
    content = content.split('\'`${process.env.REACT_APP_API_URL || "http://localhost:4000"}`/').join('`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/');
    content = content.split('"`${process.env.REACT_APP_API_URL || "http://localhost:4000"}`/').join('`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/');

    if (content !== original) {
      console.log('Fixed:', filePath);
      fs.writeFileSync(filePath, content, 'utf8');
    }
  }
});
