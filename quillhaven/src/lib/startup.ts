import { queueService } from '@/services/queueService';
import { cleanupService } from '@/services/cleanupService';

let initialized = false;

/**
 * Initialize background services
 */
export function initializeServices(): void {
  if (initialized) return;

  console.log('Initializing background services...');

  // Import export service to trigger queue processor registration
  import('@/services/exportService');

  // Start cleanup service
  cleanupService.startPeriodicCleanup(24); // Run every 24 hours

  initialized = true;
  console.log('Background services initialized');
}

/**
 * Shutdown background services
 */
export function shutdownServices(): void {
  if (!initialized) return;

  console.log('Shutting down background services...');

  // Stop queue processing
  queueService.stopProcessing();

  // Stop cleanup service
  cleanupService.stopPeriodicCleanup();

  initialized = false;
  console.log('Background services shut down');
}

// Handle process termination
process.on('SIGTERM', shutdownServices);
process.on('SIGINT', shutdownServices);