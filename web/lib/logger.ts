type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const CURRENT_LEVEL: LogLevel =
  (typeof window !== 'undefined' && (localStorage.getItem('LOG_LEVEL') as LogLevel)) ||
  (process.env.NEXT_PUBLIC_LOG_LEVEL as LogLevel) ||
  'debug';

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[CURRENT_LEVEL];
}

function formatMessage(level: LogLevel, namespace: string, args: unknown[]): unknown[] {
  const timestamp = new Date().toISOString();
  return [`[${timestamp}] [${level.toUpperCase()}] [${namespace}]`, ...args];
}

export function createLogger(namespace: string) {
  return {
    debug: (...args: unknown[]) => {
      if (shouldLog('debug')) console.debug(...formatMessage('debug', namespace, args));
    },
    info: (...args: unknown[]) => {
      if (shouldLog('info')) console.info(...formatMessage('info', namespace, args));
    },
    warn: (...args: unknown[]) => {
      if (shouldLog('warn')) console.warn(...formatMessage('warn', namespace, args));
    },
    error: (...args: unknown[]) => {
      if (shouldLog('error')) console.error(...formatMessage('error', namespace, args));
    },
  };
}

export const logger = createLogger('app');
