import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { initDatabase } from './init';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

const DB_PATH = './data/personal_finance.db';

let _db: ReturnType<typeof drizzle> | null = null;
let _sqlite: Database.Database | null = null;

function getConnection() {
  if (_db) return _db;
  mkdirSync(dirname(DB_PATH), { recursive: true });
  _sqlite = new Database(DB_PATH);
  _sqlite.pragma('journal_mode = WAL');
  _sqlite.pragma('foreign_keys = ON');
  _db = drizzle(_sqlite, { schema });
  initDatabase(_sqlite);
  return _db;
}

// Proxy so callers use `db` exactly as before — connection opens on first use
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop) {
    return (getConnection() as any)[prop];
  },
});

export function getSqlite(): Database.Database {
  getConnection();
  return _sqlite!;
}
