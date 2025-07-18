import { prisma } from '@/lib/prisma';
import * as crypto from 'crypto';

export interface QueueJob {
  id: string;
  type: string;
  data: any;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  updatedAt: Date;
  processedAt?: Date;
  error?: string;
}

export class SimpleQueueService {
  private static instance: SimpleQueueService;
  private processing = false;
  private processors: Map<string, (data: any) => Promise<void>> = new Map();

  static getInstance(): SimpleQueueService {
    if (!SimpleQueueService.instance) {
      SimpleQueueService.instance = new SimpleQueueService();
    }
    return SimpleQueueService.instance;
  }

  /**
   * Register a job processor
   */
  registerProcessor(jobType: string, processor: (data: any) => Promise<void>): void {
    this.processors.set(jobType, processor);
  }

  /**
   * Add a job to the queue
   */
  async addJob(type: string, data: any, maxAttempts: number = 3): Promise<string> {
    const job = await prisma.queueJob.create({
      data: {
        type,
        data,
        maxAttempts,
        status: 'PENDING'
      }
    });

    // Start processing if not already running
    if (!this.processing) {
      this.startProcessing();
    }

    return job.id;
  }

  /**
   * Start processing jobs
   */
  private async startProcessing(): Promise<void> {
    if (this.processing) return;
    
    this.processing = true;

    while (this.processing) {
      try {
        // Get next pending job
        const job = await prisma.queueJob.findFirst({
          where: {
            status: 'PENDING',
            attempts: {
              lt: prisma.queueJob.fields.maxAttempts
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        });

        if (!job) {
          // No jobs to process, wait a bit
          await this.sleep(5000); // Wait 5 seconds
          continue;
        }

        const processor = this.processors.get(job.type);

        if (!processor) {
          console.error(`No processor found for job type: ${job.type}`);
          await this.markJobFailed(job.id, 'No processor found');
          continue;
        }

        // Mark job as processing
        await prisma.queueJob.update({
          where: { id: job.id },
          data: {
            status: 'PROCESSING',
            attempts: {
              increment: 1
            }
          }
        });

        try {
          // Process the job
          await processor(job.data);
          
          // Mark as completed
          await prisma.queueJob.update({
            where: { id: job.id },
            data: {
              status: 'COMPLETED',
              processedAt: new Date()
            }
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          
          if (job.attempts + 1 >= job.maxAttempts) {
            await this.markJobFailed(job.id, errorMessage);
          } else {
            // Reset to pending for retry
            await prisma.queueJob.update({
              where: { id: job.id },
              data: {
                status: 'PENDING',
                error: errorMessage
              }
            });
          }
        }
      } catch (error) {
        console.error('Queue processing error:', error);
        await this.sleep(10000); // Wait 10 seconds on error
      }
    }
  }

  /**
   * Mark job as failed
   */
  private async markJobFailed(jobId: string, error: string): Promise<void> {
    await prisma.queueJob.update({
      where: { id: jobId },
      data: {
        status: 'FAILED',
        error,
        processedAt: new Date()
      }
    });
  }

  /**
   * Stop processing
   */
  stopProcessing(): void {
    this.processing = false;
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<QueueJob | null> {
    const job = await prisma.queueJob.findUnique({
      where: { id: jobId }
    });

    if (!job) return null;

    return {
      id: job.id,
      type: job.type,
      data: job.data,
      status: job.status as 'pending' | 'processing' | 'completed' | 'failed',
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      processedAt: job.processedAt,
      error: job.error
    };
  }

  /**
   * Clean up old completed jobs
   */
  async cleanupOldJobs(olderThanDays: number = 7): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    await prisma.queueJob.deleteMany({
      where: {
        status: {
          in: ['COMPLETED', 'FAILED']
        },
        updatedAt: {
          lt: cutoffDate
        }
      }
    });
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const queueService = SimpleQueueService.getInstance();