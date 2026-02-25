const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else if (file.endsWith('.jsx') || file.endsWith('.js')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk('./frontend/src');
let changedFiles = 0;

files.forEach(f => {
    let content = fs.readFileSync(f, 'utf8');
    let original = content;

    // Replace standard quoted localhost:4000 strings
    content = content.replace(/'http:\/\/localhost:4000/g, '`${process.env.REACT_APP_API_URL || "http://localhost:4000"}`');
    content = content.replace(/"http:\/\/localhost:4000/g, '`${process.env.REACT_APP_API_URL || "http://localhost:4000"}`');

    // Replace backtick localhost:4000 strings where they had variables inside
    content = content.replace(/`http:\/\/localhost:4000/g, '`${process.env.REACT_APP_API_URL || "http://localhost:4000"}');

    // Replace standard quoted 127.0.0.1:4000 strings
    content = content.replace(/'http:\/\/127\.0\.0\.1:4000/g, '`${process.env.REACT_APP_API_URL || "http://localhost:4000"}`');
    content = content.replace(/"http:\/\/127\.0\.0\.1:4000/g, '`${process.env.REACT_APP_API_URL || "http://localhost:4000"}`');

    // Fix the previously broken powershell replace which created: '${process.env.REACT_APP_API_URL || "http://localhost:4000"}'
    content = content.replace(/'\$\{process\.env\.REACT_APP_API_URL \|\| \"http:\/\/localhost:4000\"\}'/g, '`${process.env.REACT_APP_API_URL || "http://localhost:4000"}`');

    // Fix strings like: '${process.env.REACT_APP_API_URL || "http://localhost:4000"}/api/notes' (where they got broken into two strings)
    content = content.replace(/'\$\{process\.env\.REACT_APP_API_URL \|\| \"http:\/\/localhost:4000\"\}/g, '`${process.env.REACT_APP_API_URL || "http://localhost:4000"}');

    if (content !== original) {
        fs.writeFileSync(f, content, 'utf8');
        changedFiles++;
        console.log('Updated: ' + f);
    }
});

console.log(`Successfully updated ${changedFiles} files.`);
