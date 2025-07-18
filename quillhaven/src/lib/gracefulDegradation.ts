import { logger } from './logger';
import { redis } from './redis';

export interface ServiceStatus {
  isAvailable: boolean;
  lastChecked: Date;
  consecutiveFailures: number;
  nextRetryAt?: Date;
}

export interface DegradationConfig {
  maxFailures: number;
  retryDelayMs: number;
  maxRetryDelayMs: number;
  healthCheckIntervalMs: number;
}

class GracefulDegradationManager {
  private serviceStatuses = new Map<string, ServiceStatus>();
  private configs = new Map<string, DegradationConfig>();
  private healthCheckIntervals = new Map<string, NodeJS.Timeout>();

  constructor() {
    // Default configurations for different services
    this.setServiceConfig('gemini-ai', {
      maxFailures: 3,
      retryDelayMs: 5000,
      maxRetryDelayMs: 300000, // 5 minutes
      healthCheckIntervalMs: 60000, // 1 minute
    });

    this.setServiceConfig('redis', {
      maxFailures: 2,
      retryDelayMs: 1000,
      maxRetryDelayMs: 30000, // 30 seconds
      healthCheckIntervalMs: 30000, // 30 seconds
    });

    this.setServiceConfig('email', {
      maxFailures: 5,
      retryDelayMs: 10000,
      maxRetryDelayMs: 600000, // 10 minutes
      healthCheckIntervalMs: 120000, // 2 minutes
    });
  }

  public setServiceConfig(serviceName: string, config: DegradationConfig): void {
    this.configs.set(serviceName, config);
    
    // Initialize service status
    if (!this.serviceStatuses.has(serviceName)) {
      this.serviceStatuses.set(serviceName, {
        isAvailable: true,
        lastChecked: new Date(),
        consecutiveFailures: 0,
      });
    }
  }

  public isServiceAvailable(serviceName: string): boolean {
    const status = this.serviceStatuses.get(serviceName);
    if (!status) {
      logger.warn('Unknown service status requested', { serviceName });
      return true; // Default to available for unknown services
    }

    // Check if we should retry the service
    if (!status.isAvailable && status.nextRetryAt && new Date() >= status.nextRetryAt) {
      logger.info('Service retry time reached', { serviceName });
      return true; // Allow retry
    }

    return status.isAvailable;
  }

  public async recordServiceCall<T>(
    serviceName: string,
    operation: () => Promise<T>,
    fallbackOperation?: () => Promise<T>
  ): Promise<T> {
    const status = this.serviceStatuses.get(serviceName);
    const config = this.configs.get(serviceName);

    if (!status || !config) {
      logger.warn('Service not configured for degradation', { serviceName });
      return operation();
    }

    try {
      // Check if service is available
      if (!this.isServiceAvailable(serviceName)) {
        throw new Error(`Service ${serviceName} is currently unavailable`);
      }

      const result = await operation();
      
      // Success - reset failure count
      if (status.consecutiveFailures > 0) {
        logger.info('Service recovered', { 
          serviceName, 
          previousFailures: status.consecutiveFailures 
        });
        
        status.consecutiveFailures = 0;
        status.isAvailable = true;
        status.nextRetryAt = undefined;
        this.serviceStatuses.set(serviceName, status);
      }

      status.lastChecked = new Date();
      return result;
    } catch (error) {
      return this.handleServiceFailure(serviceName, error, fallbackOperation);
    }
  }

  private async handleServiceFailure<T>(
    serviceName: string,
    error: unknown,
    fallbackOperation?: () => Promise<T>
  ): Promise<T> {
    const status = this.serviceStatuses.get(serviceName)!;
    const config = this.configs.get(serviceName)!;

    status.consecutiveFailures++;
    status.lastChecked = new Date();

    logger.warn('Service call failed', {
      serviceName,
      consecutiveFailures: status.consecutiveFailures,
      maxFailures: config.maxFailures,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Check if we should mark service as unavailable
    if (status.consecutiveFailures >= config.maxFailures) {
      status.isAvailable = false;
      
      // Calculate exponential backoff delay
      const baseDelay = config.retryDelayMs;
      const exponentialDelay = baseDelay * Math.pow(2, Math.min(status.consecutiveFailures - config.maxFailures, 8));
      const delay = Math.min(exponentialDelay, config.maxRetryDelayMs);
      
      status.nextRetryAt = new Date(Date.now() + delay);

      logger.error('Service marked as unavailable', {
        serviceName,
        consecutiveFailures: status.consecutiveFailures,
        nextRetryAt: status.nextRetryAt,
      });

      // Start health check monitoring
      this.startHealthCheckMonitoring(serviceName);
    }

    this.serviceStatuses.set(serviceName, status);

    // Try fallback operation if available
    if (fallbackOperation) {
      try {
        logger.info('Attempting fallback operation', { serviceName });
        return await fallbackOperation();
      } catch (fallbackError) {
        logger.error('Fallback operation also failed', {
          serviceName,
          fallbackError: fallbackError instanceof Error ? fallbackError.message : 'Unknown error',
        });
      }
    }

    // Re-throw the original error
    throw error;
  }

  private startHealthCheckMonitoring(serviceName: string): void {
    // Clear existing interval if any
    const existingInterval = this.healthCheckIntervals.get(serviceName);
    if (existingInterval) {
      clearInterval(existingInterval);
    }

    const config = this.configs.get(serviceName);
    if (!config) return;

    const interval = setInterval(async () => {
      const status = this.serviceStatuses.get(serviceName);
      if (!status || status.isAvailable) {
        // Service is available again, stop monitoring
        clearInterval(interval);
        this.healthCheckIntervals.delete(serviceName);
        return;
      }

      // Perform health check based on service type
      try {
        await this.performHealthCheck(serviceName);
        
        // Health check passed, mark as available
        status.isAvailable = true;
        status.consecutiveFailures = 0;
        status.nextRetryAt = undefined;
        this.serviceStatuses.set(serviceName, status);

        logger.info('Service health check passed', { serviceName });
        
        // Stop monitoring
        clearInterval(interval);
        this.healthCheckIntervals.delete(serviceName);
      } catch (error) {
        logger.debug('Service health check failed', {
          serviceName,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }, config.healthCheckIntervalMs);

    this.healthCheckIntervals.set(serviceName, interval);
  }

  private async performHealthCheck(serviceName: string): Promise<void> {
    switch (serviceName) {
      case 'gemini-ai':
        await this.checkGeminiHealth();
        break;
      case 'redis':
        await this.checkRedisHealth();
        break;
      case 'email':
        await this.checkEmailHealth();
        break;
      default:
        throw new Error(`No health check implemented for service: ${serviceName}`);
    }
  }

  private async checkGeminiHealth(): Promise<void> {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
      method: 'GET',
      headers: {
        'x-goog-api-key': process.env.GEMINI_API_KEY || '',
      },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (!response.ok) {
      throw new Error(`Gemini health check failed: ${response.status}`);
    }
  }

  private async checkRedisHealth(): Promise<void> {
    const result = await redis.ping();
    if (result !== 'PONG') {
      throw new Error('Redis health check failed');
    }
  }

  private async checkEmailHealth(): Promise<void> {
    // For email, we might just check if the SMTP server is reachable
    // This is a simplified check - in practice you might want to test SMTP connection
    if (!process.env.SMTP_HOST) {
      throw new Error('Email service not configured');
    }
    // Assume healthy if configured (you could implement actual SMTP check)
  }

  public getServiceStatus(serviceName: string): ServiceStatus | null {
    return this.serviceStatuses.get(serviceName) || null;
  }

  public getAllServiceStatuses(): Record<string, ServiceStatus> {
    const statuses: Record<string, ServiceStatus> = {};
    for (const [name, status] of this.serviceStatuses.entries()) {
      statuses[name] = status;
    }
    return statuses;
  }

  public forceServiceAvailable(serviceName: string): void {
    const status = this.serviceStatuses.get(serviceName);
    if (status) {
      status.isAvailable = true;
      status.consecutiveFailures = 0;
      status.nextRetryAt = undefined;
      this.serviceStatuses.set(serviceName, status);

      // Clear health check monitoring
      const interval = this.healthCheckIntervals.get(serviceName);
      if (interval) {
        clearInterval(interval);
        this.healthCheckIntervals.delete(serviceName);
      }

      logger.info('Service manually marked as available', { serviceName });
    }
  }

  public destroy(): void {
    // Clear all health check intervals
    for (const interval of this.healthCheckIntervals.values()) {
      clearInterval(interval);
    }
    this.healthCheckIntervals.clear();
  }
}

// Create singleton instance
export const gracefulDegradation = new GracefulDegradationManager();

// Utility functions for common degradation patterns
export async function withGeminiDegradation<T>(
  operation: () => Promise<T>,
  fallback?: () => Promise<T>
): Promise<T> {
  return gracefulDegradation.recordServiceCall('gemini-ai', operation, fallback);
}

export async function withRedisDegradation<T>(
  operation: () => Promise<T>,
  fallback?: () => Promise<T>
): Promise<T> {
  return gracefulDegradation.recordServiceCall('redis', operation, fallback);
}

export async function withEmailDegradation<T>(
  operation: () => Promise<T>,
  fallback?: () => Promise<T>
): Promise<T> {
  return gracefulDegradation.recordServiceCall('email', operation, fallback);
}

// Cleanup on process exit
process.on('SIGINT', () => {
  gracefulDegradation.destroy();
});

process.on('SIGTERM', () => {
  gracefulDegradation.destroy();
});