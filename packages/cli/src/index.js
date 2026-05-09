#!/usr/bin/env node

import { Command } from 'commander';
import chokidar from 'chokidar';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { globSync } = require('glob');
import { scanExpressFile } from 'parser-express';
import { initDb, getAllRoutes, saveRoute } from './db.js';
import { diffRoutes } from './diff.js';
import { initWebSocketServer, broadcastDiff } from './websocket.js';
import { resolveModulePath } from './resolver.js';

const program = new Command();

program
  .name('payloadx')
  .description('PayloadX Static Code Analysis CLI')
  .version('1.0.0');

async function scanProject(db, scanDir) {
  const spinner = ora('Scanning routes...').start();
  
  const files = globSync('**/*.js', { 
    cwd: scanDir, 
    absolute: true,
    ignore: ['node_modules/**', '.payloadx/**', 'dist/**']
  });

  const fileData = {};
  for (const file of files) {
    fileData[file] = scanExpressFile(file);
  }

  const allScannedRoutes = [];
  const processedFiles = new Set();

  function resolveFile(filePath, prefix = '') {
    const data = fileData[filePath];
    if (!data) return;

    // Use a combination of path and prefix to allow same file mounted at different paths
    const visitKey = `${filePath}::${prefix}`;
    if (processedFiles.has(visitKey)) return;
    processedFiles.add(visitKey);

    // 1. Add routes from this file with prefix
    data.routes.forEach(r => {
      const fullPath = (prefix + r.path).replace(/\/+/g, '/') || '/';
      allScannedRoutes.push({
        ...r,
        path: fullPath
      });
    });

    // 2. Follow mounts (app.use('/prefix', router))
    data.mounts.forEach(mount => {
      const imp = data.imports.find(i => i.local === mount.identifier);
      if (imp) {
        const targetPath = resolveModulePath(filePath, imp.source);
        if (targetPath && fileData[targetPath]) {
          resolveFile(targetPath, (prefix + mount.prefix).replace(/\/+/g, '/'));
        }
      }
    });
  }

  // Start crawling from standard entry points
  const entryFiles = files.filter(f => 
    f.endsWith('server.js') || f.endsWith('app.js') || f.endsWith('index.js')
  );

  if (entryFiles.length > 0) {
    entryFiles.forEach(entry => resolveFile(entry));
  }

  // Ensure we don't miss orphaned files that aren't mounted in the main tree
  files.forEach(f => {
    const isProcessed = Array.from(processedFiles).some(key => key.startsWith(`${f}::`));
    if (!isProcessed) {
      resolveFile(f);
    }
  });

  const dbRoutes = getAllRoutes(db);
  const diff = diffRoutes(dbRoutes, allScannedRoutes);

  spinner.stop();

  let hasChanges = false;
  if (diff.newRoutes.length > 0) {
    console.log(chalk.green(`Found ${diff.newRoutes.length} new routes.`));
    hasChanges = true;
  }
  if (diff.updatedRoutes.length > 0) {
    console.log(chalk.yellow(`Found ${diff.updatedRoutes.length} updated routes.`));
    hasChanges = true;
  }
  if (diff.deletedRoutes.length > 0) {
    console.log(chalk.red(`Found ${diff.deletedRoutes.length} deleted routes.`));
    hasChanges = true;
  }

  if (hasChanges) {
    for (const route of diff.newRoutes) saveRoute(db, route);
    for (const route of diff.updatedRoutes) saveRoute(db, route);
    
    broadcastDiff(diff);
  } else {
    console.log(chalk.gray('No route changes detected.'));
  }
}

program
  .command('watch')
  .description('Watch directory and sync routes with PayloadX Desktop')
  .argument('[dir]', 'Directory to watch', './src')
  .action(async (dir) => {
    const scanDir = path.resolve(process.cwd(), dir);
    console.log(chalk.blue(`Watching directory: ${scanDir}`));
    
    const db = initDb();
    initWebSocketServer();

    await scanProject(db, scanDir);

    chokidar.watch(scanDir, {
      ignored: /(^|[\/\\])\../,
      persistent: true
    }).on('change', async (filePath) => {
      console.log(chalk.gray(`\nFile changed: ${filePath}`));
      await scanProject(db, scanDir);
    });
  });

program.parse();
