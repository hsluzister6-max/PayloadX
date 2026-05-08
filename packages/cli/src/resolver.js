import path from 'path';
import fs from 'fs';

/**
 * Resolves a relative import source to an absolute file path.
 * Handles:
 * - ./routes/auth.js
 * - ./routes/auth
 * - ./routes (if index.js exists)
 */
export function resolveModulePath(currentFile, importSource) {
  const dir = path.dirname(currentFile);
  let absolutePath = path.resolve(dir, importSource);
  
  const extensions = ['.js', '.ts', '.jsx', '.tsx'];
  
  // 1. Try direct path
  if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) return absolutePath;
  
  // 2. Try extensions
  for (const ext of extensions) {
    if (fs.existsSync(absolutePath + ext)) return absolutePath + ext;
  }
  
  // 3. Try index files
  for (const ext of extensions) {
    const indexPath = path.join(absolutePath, 'index' + ext);
    if (fs.existsSync(indexPath)) return indexPath;
  }
  
  return null;
}
