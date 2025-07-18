interface LogLevel {
  DEBUG: 0;
  INFO: 1;
  WARN: 2;
  ERROR: 3;
}

const LOG_LEVELS: LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
} as const;

type LogLevelKey = keyof LogLevel;

interface LogEntry {
  timestamp: string;
  level: LogLevelKey;
  message: string;
  data?: Record<string, unknown>;
  requestId?: string;
  userId?: string;
  service: string;
  environment: string;
}

interface LoggerConfig {
  level: LogLevelKey;
  service: string;
  environment: string;
  enableConsole: boolean;
  enableFile: boolean;
  enableRemote: boolean;
  remoteEndpoint?: string;
}

class Logger {
  private config: LoggerConfig;
  private logBuffer: LogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: (process.env.LOG_LEVEL as LogLevelKey) || 'INFO',
      service: 'QuillHaven',
      environment: process.env.NODE_ENV || 'development',
      enableConsole: true,
      enableFile: process.env.NODE_ENV === 'production',
      enableRemote: false,
      ...config,
    };

    // Start periodic log flushing in production
    if (this.config.environment === 'production') {
      this.startLogFlushing();
    }
  }

  private shouldLog(level: LogLevelKey): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.level];
  }

  private createLogEntry(
    level: LogLevelKey,
    message: string,
    data?: Record<string, unknown>
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      service: this.config.service,
      environment: this.config.environment,
    };
  }

  private formatConsoleMessage(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    const level = entry.level.padEnd(5);
    const message = entry.message;
    const data = entry.data ? ` | ${JSON.stringify(entry.data)}` : '';

    return `[${timestamp}] ${level} ${message}${data}`;
  }

  private getConsoleMethod(level: LogLevelKey): typeof console.log {
    switch (level) {
      case 'DEBUG':
        return console.debug;
      case 'INFO':
        return console.info;
      case 'WARN':
        return console.warn;
      case 'ERROR':
        return console.error;
      default:
        return console.log;
    }
  }

  private async writeLog(entry: LogEntry): Promise<void> {
    // Console logging
    if (this.config.enableConsole) {
      const consoleMethod = this.getConsoleMethod(entry.level);
      consoleMethod(this.formatConsoleMessage(entry));
    }

    // Buffer for file/remote logging
    if (this.config.enableFile || this.config.enableRemote) {
      this.logBuffer.push(entry);
    }
  }

  private startLogFlushing(): void {
    this.flushInterval = setInterval(() => {
      this.flushLogs();
    }, 5000); // Flush every 5 seconds
  }

  private async flushLogs(): Promise<void> {
    if (this.logBuffer.length === 0) return;

    const logsToFlush = [...this.logBuffer];
    this.logBuffer = [];

    try {
      // File logging (in production, you might want to use a proper logging library)
      if (this.config.enableFile) {
        await this.writeToFile(logsToFlush);
      }

      // Remote logging (send to external service)
      if (this.config.enableRemote && this.config.remoteEndpoint) {
        await this.sendToRemote(logsToFlush);
      }
    } catch (error) {
      // If logging fails, at least log to console
      console.error('Failed to flush logs:', error);
      // Put logs back in buffer for retry
      this.logBuffer.unshift(...logsToFlush);
    }
  }

  private async writeToFile(logs: LogEntry[]): Promise<void> {
    // In a real implementation, you'd use fs.appendFile or a logging library
    // For now, we'll just log to console in production
    if (this.config.environment === 'production') {
      logs.forEach((log) => {
        console.log(JSON.stringify(log));
      });
    }
  }

  private async sendToRemote(logs: LogEntry[]): Promise<void> {
    if (!this.config.remoteEndpoint) return;

    try {
      await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ logs }),
      });
    } catch (error) {
      throw new Error(`Failed to send logs to remote endpoint: ${error}`);
    }
  }

  public debug(message: string, data?: Record<string, unknown>): void {
    if (!this.shouldLog('DEBUG')) return;

    const entry = this.createLogEntry('DEBUG', message, data);
    this.writeLog(entry);
  }

  public info(message: string, data?: Record<string, unknown>): void {
    if (!this.shouldLog('INFO')) return;

    const entry = this.createLogEntry('INFO', message, data);
    this.writeLog(entry);
  }

  public warn(message: string, data?: Record<string, unknown>): void {
    if (!this.shouldLog('WARN')) return;

    const entry = this.createLogEntry('WARN', message, data);
    this.writeLog(entry);
  }

  public error(message: string, data?: Record<string, unknown>): void {
    if (!this.shouldLog('ERROR')) return;

    const entry = this.createLogEntry('ERROR', message, data);
    this.writeLog(entry);
  }

  public setRequestContext(requestId: string, userId?: string): Logger {
    const contextLogger = new Logger(this.config);
    contextLogger.logBuffer = this.logBuffer;
    contextLogger.flushInterval = this.flushInterval;

    // Override createLogEntry to include context
    const originalCreateLogEntry =
      contextLogger.createLogEntry.bind(contextLogger);
    contextLogger.createLogEntry = (level, message, data) => {
      const entry = originalCreateLogEntry(level, message, data);
      entry.requestId = requestId;
      entry.userId = userId;
      return entry;
    };

    return contextLogger;
  }

  public async flush(): Promise<void> {
    await this.flushLogs();
  }

  public destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    this.flushLogs(); // Final flush
  }
}

// Create singleton logger instance
export const logger = new Logger();

// Performance monitoring utilities
export class PerformanceLogger {
  private static timers = new Map<string, number>();

  public static startTimer(label: string): void {
    this.timers.set(label, Date.now());
  }

  public static endTimer(
    label: string,
    additionalData?: Record<string, unknown>
  ): void {
    const startTime = this.timers.get(label);
    if (!startTime) {
      logger.warn('Timer not found', { label });
      return;
    }

    const duration = Date.now() - startTime;
    this.timers.delete(label);

    logger.info('Performance metric', {
      metric: label,
      duration,
      ...additionalData,
    });
  }

  public static async measureAsync<T>(
    label: string,
    operation: () => Promise<T>,
    additionalData?: Record<string, unknown>
  ): Promise<T> {
    this.startTimer(label);
    try {
      const result = await operation();
      this.endTimer(label, { success: true, ...additionalData });
      return result;
    } catch (error) {
      this.endTimer(label, {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        ...additionalData,
      });
      throw error;
    }
  }

  public static measure<T>(
    label: string,
    operation: () => T,
    additionalData?: Record<string, unknown>
  ): T {
    this.startTimer(label);
    try {
      const result = operation();
      this.endTimer(label, { success: true, ...additionalData });
      return result;
    } catch (error) {
      this.endTimer(label, {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        ...additionalData,
      });
      throw error;
    }
  }
}

// Security event logging
export class SecurityLogger {
  public static logAuthAttempt(
    success: boolean,
    email: string,
    ip: string,
    userAgent?: string
  ): void {
    logger.info('Authentication attempt', {
      event: 'auth_attempt',
      success,
      email,
      ip,
      userAgent,
      severity: success ? 'low' : 'medium',
    });
  }

  public static logSuspiciousActivity(
    type: string,
    details: Record<string, unknown>,
    ip: string,
    userId?: string
  ): void {
    logger.warn('Suspicious activity detected', {
      event: 'suspicious_activity',
      type,
      details,
      ip,
      userId,
      severity: 'high',
    });
  }

  public static logRateLimitExceeded(
    endpoint: string,
    ip: string,
    userId?: string
  ): void {
    logger.warn('Rate limit exceeded', {
      event: 'rate_limit_exceeded',
      endpoint,
      ip,
      userId,
      severity: 'medium',
    });
  }

  public static logDataAccess(
    resource: string,
    action: string,
    userId: string,
    success: boolean
  ): void {
    logger.info('Data access', {
      event: 'data_access',
      resource,
      action,
      userId,
      success,
      severity: 'low',
    });
  }
}

// Business metrics logging
export class BusinessLogger {
  public static logUserAction(
    action: string,
    userId: string,
    details?: Record<string, unknown>
  ): void {
    logger.info('User action', {
      event: 'user_action',
      action,
      userId,
      details,
    });
  }

  public static logAIGeneration(
    userId: string,
    projectId: string,
    chapterId: string,
    wordCount: number,
    duration: number,
    success: boolean
  ): void {
    logger.info('AI generation', {
      event: 'ai_generation',
      userId,
      projectId,
      chapterId,
      wordCount,
      duration,
      success,
    });
  }

  public static logExport(
    userId: string,
    projectId: string,
    format: string,
    chapterCount: number,
    wordCount: number,
    success: boolean
  ): void {
    logger.info('Project export', {
      event: 'project_export',
      userId,
      projectId,
      format,
      chapterCount,
      wordCount,
      success,
    });
  }
}

// Cleanup on process exit
process.on('SIGINT', () => {
  logger.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.destroy();
  process.exit(0);
});
