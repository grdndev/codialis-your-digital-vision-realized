const fs = require('fs');
let index = fs.readFileSync('index.html', 'utf8');
const newStyle = fs.readFileSync('style.css', 'utf8');

const startIndex = index.indexOf('<style>');
const endIndex = index.indexOf('</style>') + '</style>'.length;

if (startIndex !== -1 && endIndex !== -1) {
    const before = index.substring(0, startIndex);
    const after = index.substring(endIndex);
    fs.writeFileSync('index.html', before + newStyle + after);
    console.log('Successfully replaced <style> block in index.html');
} else {
    console.error('Could not find <style> block in index.html');
}
