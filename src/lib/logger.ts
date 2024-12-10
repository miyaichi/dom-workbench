import { LogLevel, loadSettings } from './settings';

const LOG_LEVEL_PRIORITIES: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

/**
 * A logger class that provides context-aware logging functionality with configurable log levels.
 * Supports logging at error, warn, info, and debug levels with message context prefixing.
 */
export class Logger {
  private static logLevel: LogLevel = 'info';

  /**
   * Creates an instance of Logger with a specific context
   * @param context - The context for the logger instance
   */
  constructor(private context: string) {
    // Initialize log level from settings
    this.initialize();
  }

  /**
   * Initializes the log level from settings
   */
  private async initialize() {
    try {
      const settings = await loadSettings();
      Logger.logLevel = settings.logLevel;
    } catch (error) {
      console.error('Failed to load log level from settings:', error);
    }
  }

  /**
   * Determines if a message should be logged based on the current log level
   * @param level - The log level of the message
   * @returns A boolean indicating whether the message should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITIES[level] <= LOG_LEVEL_PRIORITIES[Logger.logLevel];
  }

  /**
   * Logs a debug message if the current log level is 'debug'
   * @param message - The message to log
   * @param args - Additional arguments to log
   */
  debug(message: string, ...args: any[]) {
    if (this.shouldLog('debug')) {
      console.debug(`[${this.context}] ${message}`, ...args);
    }
  }

  /**
   * Logs an info message if the current log level is 'info' or lower
   * @param message - The message to log
   * @param args - Additional arguments to log
   */
  info(message: string, ...args: any[]) {
    if (this.shouldLog('info')) {
      console.log(`[${this.context}] ${message}`, ...args);
    }
  }

  /**
   * Logs a warning message if the current log level is 'warn' or lower
   * @param message - The message to log
   * @param args - Additional arguments to log
   */
  warn(message: string, ...args: any[]) {
    if (this.shouldLog('warn')) {
      console.warn(`[${this.context}] ${message}`, ...args);
    }
  }

  /**
   * Logs an error message if the current log level is 'error'
   * @param message - The message to log
   * @param args - Additional arguments to log
   */
  error(message: string, ...args: any[]) {
    if (this.shouldLog('error')) {
      console.error(`[${this.context}] ${message}`, ...args);
    }
  }
}
