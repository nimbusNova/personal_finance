import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { initDatabase } from './init';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

const DB_PATH = './data/personal_finance.db';
mkdirSync(dirname(DB_PATH), { recursive: true });

const sqlite = new Database(DB_PATH);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });
export { sqlite };

// Initialize tables on first load
initDatabase();
