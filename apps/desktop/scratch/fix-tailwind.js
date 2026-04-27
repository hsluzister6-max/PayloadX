const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
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

const files = walk('./src');
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  const newContent = content
    .replace(/(border|bg|text)-surface-([0-9]+)\/[0-9]+/g, '$1-surface-$2')
    .replace(/border-surface-700/g, 'border-[var(--border-1)]')
    .replace(/bg-surface-800/g, 'bg-[var(--surface-3)]')
    .replace(/bg-surface-700/g, 'bg-[var(--surface-2)]');
    
  if (content !== newContent) {
    fs.writeFileSync(file, newContent);
    console.log('Fixed CSS opacity tokens in:', file);
  }
});
