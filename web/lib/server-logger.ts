import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Resolve log dir relative to this file so it works regardless of where
// the Next.js server was started from.
const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_DIR = join(__dirname, '..', '..', 'data', 'logs');

// Capture the session start time once at module load so all logs from this
// server session go to the same file (e.g. 2026-04-19_16-30-00.log).
const SESSION_START = new Date();

function sessionFileName(): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const d = SESSION_START;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}.log`;
}

function ensureLogDir() {
  if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
}

function logFilePath(): string {
  return join(LOG_DIR, sessionFileName());
}

function formatLine(level: string, namespace: string, message: string): string {
  const ts = new Date().toISOString();
  return `[${ts}] [${level.toUpperCase()}] [${namespace}] ${message}`;
}

export function serverLog(level: 'debug' | 'info' | 'warn' | 'error', namespace: string, message: string, extra?: string) {
  ensureLogDir();
  const line = formatLine(level, namespace, message);
  const full = extra ? `${line}\n${extra}\n` : `${line}\n`;
  appendFileSync(logFilePath(), full);

  // Echo to console for dev visibility
  const consoleMethod = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  consoleMethod(line);
  if (extra) consoleMethod(extra);
}

export function createServerLogger(namespace: string) {
  return {
    debug: (msg: string, extra?: string) => serverLog('debug', namespace, msg, extra),
    info: (msg: string, extra?: string) => serverLog('info', namespace, msg, extra),
    warn: (msg: string, extra?: string) => serverLog('warn', namespace, msg, extra),
    error: (msg: string, extra?: string) => serverLog('error', namespace, msg, extra),
  };
}
