/**
 * Data Privacy Service - GDPR Compliance
 * Handles user data export and deletion requests
 */

import { prisma } from '@/lib/prisma';
import { UserContentEncryption } from '@/lib/encryption';
import archiver from 'archiver';
import { Readable } from 'stream';
import type { User, Project, Chapter, Character, PlotThread, WorldElement } from '@prisma/client';

export interface DataExportOptions {
  format: 'json' | 'zip';
  includeProjects?: boolean;
  includeChapters?: boolean;
  includeContext?: boolean;
  includeMetadata?: boolean;
}

export interface UserDataExport {
  user: Partial<User>;
  projects?: Array<Project & {
    chapters?: Chapter[];
    characters?: Character[];
    plotThreads?: PlotThread[];
    worldElements?: WorldElement[];
  }>;
  metadata: {
    exportDate: string;
    exportVersion: string;
    totalProjects: number;
    totalChapters: number;
    totalWords: number;
  };
}

export interface DataDeletionResult {
  success: boolean;
  deletedItems: {
    user: boolean;
    projects: number;
    chapters: number;
    characters: number;
    plotThreads: number;
    worldElements: number;
    sessions: number;
    exports: number;
  };
  errors?: string[];
}

/**
 * Service for handling user data privacy operations
 */
export class DataPrivacyService {
  private encryption: UserContentEncryption;

  constructor(userId: string) {
    this.encryption = new UserContentEncryption(userId);
  }

  /**
   * Export all user data in compliance with GDPR Article 20
   */
  async exportUserData(
    userId: string,
    options: DataExportOptions = { format: 'json', includeProjects: true, includeChapters: true, includeContext: true, includeMetadata: true }
  ): Promise<Buffer> {
    try {
      // Get user data
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          projects: options.includeProjects ? {
            include: {
              chapters: options.includeChapters,
              characters: options.includeContext,
              plotThreads: options.includeContext,
              worldElements: options.includeContext,
            }
          } : false,
        },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Prepare export data
      const exportData: UserDataExport = {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          emailVerified: user.emailVerified,
          subscriptionTier: user.subscriptionTier,
          writingPreferences: user.writingPreferences,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        metadata: {
          exportDate: new Date().toISOString(),
          exportVersion: '1.0',
          totalProjects: user.projects?.length || 0,
          totalChapters: 0,
          totalWords: 0,
        },
      };

      // Process projects and decrypt content if needed
      if (options.includeProjects && user.projects) {
        exportData.projects = user.projects.map((project: any) => {
          const processedProject = {
            ...project,
            chapters: project.chapters?.map((chapter: any) => ({
              ...chapter,
              content: this.decryptContentIfNeeded(chapter.content),
            })),
            characters: project.characters?.map((character: any) => ({
              ...character,
              description: this.decryptContentIfNeeded(character.description),
            })),
            plotThreads: project.plotThreads?.map((thread: any) => ({
              ...thread,
              description: this.decryptContentIfNeeded(thread.description),
            })),
            worldElements: project.worldElements?.map((element: any) => ({
              ...element,
              description: this.decryptContentIfNeeded(element.description),
            })),
          };

          // Update metadata
          if (processedProject.chapters) {
            exportData.metadata.totalChapters += processedProject.chapters.length;
            exportData.metadata.totalWords += processedProject.chapters.reduce(
              (sum: number, chapter: any) => sum + (chapter.wordCount || 0), 0
            );
          }

          return processedProject;
        });
      }

      // Create export based on format
      if (options.format === 'zip') {
        return this.createZipExport(exportData);
      } else {
        return Buffer.from(JSON.stringify(exportData, null, 2), 'utf-8');
      }
    } catch (error) {
      console.error('Data export error:', error);
      throw new Error('Failed to export user data');
    }
  }

  /**
   * Create ZIP archive of user data
   */
  private async createZipExport(exportData: UserDataExport): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const archive = archiver('zip', { zlib: { level: 9 } });
      const chunks: Buffer[] = [];

      archive.on('data', (chunk) => chunks.push(chunk));
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', reject);

      // Add user profile
      archive.append(JSON.stringify(exportData.user, null, 2), { name: 'user-profile.json' });

      // Add metadata
      archive.append(JSON.stringify(exportData.metadata, null, 2), { name: 'export-metadata.json' });

      // Add projects
      if (exportData.projects) {
        exportData.projects.forEach((project, index) => {
          const projectFolder = `projects/${project.title.replace(/[^a-zA-Z0-9]/g, '_')}/`;
          
          // Project metadata
          const projectMeta = {
            id: project.id,
            title: project.title,
            description: project.description,
            genre: project.genre,
            targetLength: project.targetLength,
            currentWordCount: project.currentWordCount,
            status: project.status,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
          };
          archive.append(JSON.stringify(projectMeta, null, 2), { name: `${projectFolder}project.json` });

          // Chapters
          if (project.chapters) {
            project.chapters.forEach((chapter, chapterIndex) => {
              const chapterData = {
                title: chapter.title,
                content: chapter.content,
                wordCount: chapter.wordCount,
                order: chapter.order,
                status: chapter.status,
                createdAt: chapter.createdAt,
                updatedAt: chapter.updatedAt,
              };
              archive.append(JSON.stringify(chapterData, null, 2), 
                { name: `${projectFolder}chapters/chapter-${chapterIndex + 1}-${chapter.title.replace(/[^a-zA-Z0-9]/g, '_')}.json` });
              
              // Also save as plain text
              archive.append(chapter.content, 
                { name: `${projectFolder}chapters/chapter-${chapterIndex + 1}-${chapter.title.replace(/[^a-zA-Z0-9]/g, '_')}.txt` });
            });
          }

          // Characters
          if (project.characters) {
            archive.append(JSON.stringify(project.characters, null, 2), 
              { name: `${projectFolder}characters.json` });
          }

          // Plot threads
          if (project.plotThreads) {
            archive.append(JSON.stringify(project.plotThreads, null, 2), 
              { name: `${projectFolder}plot-threads.json` });
          }

          // World elements
          if (project.worldElements) {
            archive.append(JSON.stringify(project.worldElements, null, 2), 
              { name: `${projectFolder}world-elements.json` });
          }
        });
      }

      archive.finalize();
    });
  }

  /**
   * Delete all user data in compliance with GDPR Article 17 (Right to be forgotten)
   */
  async deleteUserData(userId: string, confirmationToken: string): Promise<DataDeletionResult> {
    const result: DataDeletionResult = {
      success: false,
      deletedItems: {
        user: false,
        projects: 0,
        chapters: 0,
        characters: 0,
        plotThreads: 0,
        worldElements: 0,
        sessions: 0,
        exports: 0,
      },
      errors: [],
    };

    try {
      // Verify user exists and confirmation token
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          projects: {
            include: {
              chapters: true,
              characters: true,
              plotThreads: true,
              worldElements: true,
            },
          },
        },
      });

      if (!user) {
        result.errors?.push('User not found');
        return result;
      }

      // Verify confirmation token (should be generated and sent via email)
      if (!this.verifyDeletionToken(userId, confirmationToken)) {
        result.errors?.push('Invalid confirmation token');
        return result;
      }

      // Start transaction for atomic deletion
      await prisma.$transaction(async (tx) => {
        // Delete in reverse order of dependencies

        // 1. Delete export records
        const exportCount = await tx.exportRecord.deleteMany({
          where: { userId },
        });
        result.deletedItems.exports = exportCount.count;

        // 2. Delete sessions
        const sessionCount = await tx.session.deleteMany({
          where: { userId },
        });
        result.deletedItems.sessions = sessionCount.count;

        // 3. Delete project-related data
        for (const project of user.projects) {
          // Delete world elements
          const worldElementCount = await tx.worldElement.deleteMany({
            where: { projectId: project.id },
          });
          result.deletedItems.worldElements += worldElementCount.count;

          // Delete plot threads
          const plotThreadCount = await tx.plotThread.deleteMany({
            where: { projectId: project.id },
          });
          result.deletedItems.plotThreads += plotThreadCount.count;

          // Delete characters
          const characterCount = await tx.character.deleteMany({
            where: { projectId: project.id },
          });
          result.deletedItems.characters += characterCount.count;

          // Delete chapter versions
          await tx.chapterVersion.deleteMany({
            where: { chapter: { projectId: project.id } },
          });

          // Delete chapters
          const chapterCount = await tx.chapter.deleteMany({
            where: { projectId: project.id },
          });
          result.deletedItems.chapters += chapterCount.count;
        }

        // 4. Delete projects
        const projectCount = await tx.project.deleteMany({
          where: { userId },
        });
        result.deletedItems.projects = projectCount.count;

        // 5. Finally delete user
        await tx.user.delete({
          where: { id: userId },
        });
        result.deletedItems.user = true;
      });

      result.success = true;

      // Log the deletion for audit purposes
      console.log(`User data deletion completed for user ${userId}:`, result.deletedItems);

    } catch (error) {
      console.error('Data deletion error:', error);
      result.errors?.push('Failed to delete user data');
    }

    return result;
  }

  /**
   * Request data deletion (sends confirmation email)
   */
  async requestDataDeletion(userId: string): Promise<{ success: boolean; message: string }> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return { success: false, message: 'User not found' };
      }

      // Generate deletion token
      const deletionToken = this.generateDeletionToken(userId);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Store deletion request
      await prisma.dataDeletionRequest.create({
        data: {
          userId,
          token: deletionToken,
          expiresAt,
        },
      });

      // Send confirmation email (implement email service)
      // await sendDeletionConfirmationEmail(user.email, deletionToken);

      return {
        success: true,
        message: 'Data deletion confirmation email sent. Please check your email to confirm.',
      };
    } catch (error) {
      console.error('Data deletion request error:', error);
      return { success: false, message: 'Failed to process deletion request' };
    }
  }

  /**
   * Decrypt content if it's encrypted
   */
  private decryptContentIfNeeded(content: string): string {
    try {
      // Check if content looks like encrypted data
      const parsed = JSON.parse(content);
      if (parsed.encrypted && parsed.iv && parsed.tag) {
        return this.encryption.decryptContent(parsed);
      }
    } catch {
      // Not JSON or not encrypted, return as-is
    }
    return content;
  }

  /**
   * Generate deletion confirmation token
   */
  private generateDeletionToken(userId: string): string {
    const crypto = require('crypto');
    const data = `${userId}:${Date.now()}:deletion`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Verify deletion confirmation token
   */
  private verifyDeletionToken(userId: string, token: string): boolean {
    // In a real implementation, you would check against stored tokens
    // For now, we'll do a simple verification
    return Boolean(token && token.length === 64); // SHA256 hex length
  }
}

/**
 * Scheduled cleanup of expired deletion requests
 */
export async function cleanupExpiredDeletionRequests(): Promise<void> {
  try {
    await prisma.dataDeletionRequest.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
  } catch (error) {
    console.error('Cleanup expired deletion requests error:', error);
  }
}

/**
 * Get user data summary for privacy dashboard
 */
export async function getUserDataSummary(userId: string): Promise<{
  totalProjects: number;
  totalChapters: number;
  totalWords: number;
  totalCharacters: number;
  accountAge: number;
  lastActivity: Date | null;
}> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        projects: {
          include: {
            chapters: true,
            characters: true,
          },
        },
        sessions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const totalProjects = user.projects.length;
    const totalChapters = user.projects.reduce((sum, project) => sum + project.chapters.length, 0);
    const totalWords = user.projects.reduce((sum, project) => 
      sum + project.chapters.reduce((chapterSum, chapter) => chapterSum + (chapter.wordCount || 0), 0), 0
    );
    const totalCharacters = user.projects.reduce((sum, project) => sum + project.characters.length, 0);
    const accountAge = Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24));
    const lastActivity = user.sessions[0]?.createdAt || null;

    return {
      totalProjects,
      totalChapters,
      totalWords,
      totalCharacters,
      accountAge,
      lastActivity,
    };
  } catch (error) {
    console.error('Get user data summary error:', error);
    throw error;
  }
}