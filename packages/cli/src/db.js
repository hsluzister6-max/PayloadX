import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(process.cwd(), '.payloadx');
const DB_PATH = path.join(DB_DIR, 'cache.db');

export function initDb() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  const db = new Database(DB_PATH);
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS routes (
      id TEXT PRIMARY KEY,
      method TEXT,
      path TEXT,
      request_schema TEXT,
      response_schema TEXT,
      middleware TEXT,
      handler TEXT,
      hash TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return db;
}

export function saveRoute(db, route) {
  const stmt = db.prepare(`
    INSERT INTO routes (id, method, path, request_schema, response_schema, middleware, handler, hash)
    VALUES (@id, @method, @path, @request_schema, @response_schema, @middleware, @handler, @hash)
    ON CONFLICT(id) DO UPDATE SET
      request_schema=excluded.request_schema,
      response_schema=excluded.response_schema,
      middleware=excluded.middleware,
      handler=excluded.handler,
      hash=excluded.hash
  `);
  stmt.run(route);
}

export function getAllRoutes(db) {
  return db.prepare('SELECT * FROM routes').all();
}
