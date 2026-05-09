import fs from 'fs';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import * as t from '@babel/types';

// Workaround for ES modules import
const traverse = traverseModule.default || traverseModule;

export function parseFile(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  return parse(code, {
    sourceType: 'module',
    plugins: [
      'typescript',
      'jsx',
      'decorators-legacy'
    ]
  });
}

export { traverse, t };
