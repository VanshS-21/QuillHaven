import { exportService } from './exportService';
import { queueService } from './queueService';

export class CleanupService {
  private static instance: CleanupService;
  private intervalId: NodeJS.Timeout | null = null;

  static getInstance(): CleanupService {
    if (!CleanupService.instance) {
      CleanupService.instance = new CleanupService();
    }
    return CleanupService.instance;
  }

  /**
   * Start periodic cleanup
   */
  startPeriodicCleanup(intervalHours: number = 24): void {
    if (this.intervalId) {
      this.stopPeriodicCleanup();
    }

    const intervalMs = intervalHours * 60 * 60 * 1000;
    
    this.intervalId = setInterval(async () => {
      try {
        await this.runCleanup();
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    }, intervalMs);

    // Run initial cleanup
    this.runCleanup().catch(error => {
      console.error('Initial cleanup error:', error);
    });
  }

  /**
   * Stop periodic cleanup
   */
  stopPeriodicCleanup(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Run cleanup tasks
   */
  async runCleanup(): Promise<void> {
    console.log('Starting cleanup tasks...');

    // Clean up expired exports
    await exportService.cleanupExpiredExports();
    console.log('Cleaned up expired exports');

    // Clean up old queue jobs
    await queueService.cleanupOldJobs(7); // Keep jobs for 7 days
    console.log('Cleaned up old queue jobs');

    console.log('Cleanup tasks completed');
  }
}

export const cleanupService = CleanupService.getInstance();