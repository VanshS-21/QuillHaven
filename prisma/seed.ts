/**
 * Database Seed Script
 *
 * This script seeds the QuillHaven database with initial data including:
 * - Subscription plans (Free, Premium, Professional)
 * - Sample users for development and testing
 * - Sample projects with statistics
 * - Development environment data
 */

import { PrismaClient } from '../src/generated/prisma'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seeding...')

  // Clean existing data in development
  if (process.env.NODE_ENV === 'development') {
    console.log('🧹 Cleaning existing data...')
    await prisma.billingTransaction.deleteMany()
    await prisma.paymentMethod.deleteMany()
    await prisma.usageMetrics.deleteMany()
    await prisma.subscription.deleteMany()
    await prisma.subscriptionPlan.deleteMany()
    await prisma.projectStatistics.deleteMany()
    await prisma.project.deleteMany()
    await prisma.userSession.deleteMany()
    await prisma.userProfile.deleteMany()
    await prisma.user.deleteMany()
  }

  // Create subscription plans
  console.log('📋 Creating subscription plans...')

  const freePlan = await prisma.subscriptionPlan.create({
    data: {
      id: 'plan_free',
      name: 'Free',
      description:
        'Perfect for getting started with your first novel. Includes basic AI assistance and essential writing tools.',
      price: 0,
      currency: 'USD',
      interval: 'MONTHLY',
      features: [
        'Up to 10 chapters per month',
        'Basic AI writing assistance',
        '1 active project',
        'Standard export formats (PDF, DOCX)',
        'Community support',
      ],
      limits: {
        chaptersPerMonth: 10,
        projectsLimit: 1,
        storageLimit: 100, // MB
        collaboratorsLimit: 0,
        exportFormats: ['PDF', 'DOCX'],
        aiModelsAccess: ['basic'],
        prioritySupport: false,
      },
      sortOrder: 1,
    },
  })

  const premiumPlan = await prisma.subscriptionPlan.create({
    data: {
      id: 'plan_premium',
      name: 'Premium',
      description:
        'For serious writers working on multiple projects. Advanced AI features and enhanced productivity tools.',
      price: 19.99,
      currency: 'USD',
      interval: 'MONTHLY',
      features: [
        'Up to 50 chapters per month',
        'Advanced AI writing assistance',
        '5 active projects',
        'All export formats',
        'Character and plot tracking',
        'Priority email support',
      ],
      limits: {
        chaptersPerMonth: 50,
        projectsLimit: 5,
        storageLimit: 1000, // MB
        collaboratorsLimit: 2,
        exportFormats: ['PDF', 'DOCX', 'EPUB', 'HTML', 'TXT'],
        aiModelsAccess: ['basic', 'advanced'],
        prioritySupport: true,
      },
      sortOrder: 2,
    },
  })

  const professionalPlan = await prisma.subscriptionPlan.create({
    data: {
      id: 'plan_professional',
      name: 'Professional',
      description:
        'For professional authors and content creators. Unlimited projects and premium AI models.',
      price: 39.99,
      currency: 'USD',
      interval: 'MONTHLY',
      features: [
        'Up to 200 chapters per month',
        'Premium AI models and features',
        'Unlimited projects',
        'All export formats',
        'Advanced analytics and insights',
        'Collaboration tools',
        'Priority support with dedicated account manager',
      ],
      limits: {
        chaptersPerMonth: 200,
        projectsLimit: -1, // Unlimited
        storageLimit: 10000, // MB
        collaboratorsLimit: 10,
        exportFormats: ['PDF', 'DOCX', 'EPUB', 'HTML', 'TXT', 'MOBI'],
        aiModelsAccess: ['basic', 'advanced', 'premium'],
        prioritySupport: true,
      },
      sortOrder: 3,
    },
  })

  // Create sample users for development
  console.log('👥 Creating sample users...')

  const hashedPassword = await hash('password123', 12)

  const adminUser = await prisma.user.create({
    data: {
      id: 'user_admin',
      email: 'admin@quillhaven.com',
      emailVerified: true,
      firstName: 'Admin',
      lastName: 'User',
      displayName: 'QuillHaven Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
      lastLoginAt: new Date(),
      profile: {
        create: {
          bio: 'QuillHaven platform administrator',
          experienceLevel: 'Expert',
          writingGenres: ['Fantasy', 'Science Fiction'],
          preferences: {
            theme: 'dark',
            language: 'en',
            timezone: 'UTC',
            emailNotifications: true,
            autoSave: true,
            autoSaveInterval: 30,
          },
        },
      },
    },
  })

  const sampleUser1 = await prisma.user.create({
    data: {
      id: 'user_sample_1',
      email: 'writer@example.com',
      emailVerified: true,
      firstName: 'Jane',
      lastName: 'Writer',
      displayName: 'Jane W.',
      role: 'USER',
      status: 'ACTIVE',
      lastLoginAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      profile: {
        create: {
          bio: 'Aspiring novelist working on my first fantasy series. Love creating immersive worlds and complex characters.',
          location: 'Portland, OR',
          experienceLevel: 'Intermediate',
          writingGenres: ['Fantasy', 'Young Adult'],
          goals: [
            { type: 'word_count', target: 80000, deadline: '2025-06-01' },
            { type: 'chapters', target: 20, deadline: '2025-04-01' },
          ],
          preferences: {
            theme: 'light',
            language: 'en',
            timezone: 'America/Los_Angeles',
            emailNotifications: true,
            autoSave: true,
            autoSaveInterval: 60,
          },
        },
      },
      subscription: {
        create: {
          planId: premiumPlan.id,
          status: 'ACTIVE',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          usageMetrics: {
            create: {
              chaptersGenerated: 15,
              chaptersRemaining: 35,
              storageUsed: 250,
              storageLimit: 1000,
              collaboratorsUsed: 1,
              collaboratorsLimit: 2,
              resetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          },
        },
      },
    },
  })

  const sampleUser2 = await prisma.user.create({
    data: {
      id: 'user_sample_2',
      email: 'novelist@example.com',
      emailVerified: true,
      firstName: 'Marcus',
      lastName: 'Stone',
      displayName: 'M. Stone',
      role: 'USER',
      status: 'ACTIVE',
      lastLoginAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
      profile: {
        create: {
          bio: 'Professional author with 5 published novels. Currently working on a science fiction trilogy.',
          location: 'New York, NY',
          website: 'https://marcusstone.com',
          experienceLevel: 'Expert',
          writingGenres: ['Science Fiction', 'Thriller'],
          goals: [
            { type: 'word_count', target: 120000, deadline: '2025-08-01' },
            { type: 'books', target: 3, deadline: '2025-12-31' },
          ],
          preferences: {
            theme: 'dark',
            language: 'en',
            timezone: 'America/New_York',
            emailNotifications: false,
            autoSave: true,
            autoSaveInterval: 30,
          },
        },
      },
      subscription: {
        create: {
          planId: professionalPlan.id,
          status: 'ACTIVE',
          currentPeriodStart: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
          currentPeriodEnd: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days from now
          usageMetrics: {
            create: {
              chaptersGenerated: 45,
              chaptersRemaining: 155,
              storageUsed: 2500,
              storageLimit: 10000,
              collaboratorsUsed: 3,
              collaboratorsLimit: 10,
              resetDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
            },
          },
        },
      },
    },
  })

  // Create sample projects
  console.log('📚 Creating sample projects...')

  const project1 = await prisma.project.create({
    data: {
      id: 'project_1',
      userId: sampleUser1.id,
      title: 'The Crystal Prophecy',
      description:
        'A young mage discovers an ancient prophecy that could save or destroy her world. First book in the Ethereal Realms series.',
      genre: 'Fantasy',
      targetWordCount: 80000,
      currentWordCount: 32500,
      status: 'IN_PROGRESS',
      visibility: 'PRIVATE',
      tags: ['fantasy', 'magic', 'prophecy', 'young-adult'],
      settings: {
        autoSave: true,
        autoSaveInterval: 60,
        spellCheck: true,
        grammarCheck: true,
        aiAssistance: true,
        collaborationEnabled: false,
        exportFormats: ['PDF', 'DOCX', 'EPUB'],
        backupEnabled: true,
        versionControl: true,
      },
      lastAccessedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      statistics: {
        create: {
          totalWords: 32500,
          totalChapters: 8,
          completedChapters: 6,
          averageWordsPerChapter: 4063,
          writingStreak: 12,
          totalWritingTime: 2400, // 40 hours in minutes
          sessionsCount: 24,
          lastWritingSession: new Date(Date.now() - 2 * 60 * 60 * 1000),
          progressPercentage: 40.6,
          dailyWordCounts: [
            {
              date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
              wordsWritten: 1200,
              timeSpent: 90,
              chaptersWorked: 1,
            },
            {
              date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
              wordsWritten: 800,
              timeSpent: 60,
              chaptersWorked: 1,
            },
            {
              date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
              wordsWritten: 1500,
              timeSpent: 120,
              chaptersWorked: 2,
            },
            {
              date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
              wordsWritten: 900,
              timeSpent: 75,
              chaptersWorked: 1,
            },
            {
              date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
              wordsWritten: 1100,
              timeSpent: 85,
              chaptersWorked: 1,
            },
            {
              date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
              wordsWritten: 1300,
              timeSpent: 95,
              chaptersWorked: 1,
            },
          ],
        },
      },
    },
  })

  const project2 = await prisma.project.create({
    data: {
      id: 'project_2',
      userId: sampleUser1.id,
      title: 'Character Development Notes',
      description:
        'Detailed character profiles and development notes for The Crystal Prophecy series.',
      genre: 'Fantasy',
      targetWordCount: 15000,
      currentWordCount: 8200,
      status: 'IN_PROGRESS',
      visibility: 'PRIVATE',
      tags: ['fantasy', 'characters', 'notes', 'reference'],
      settings: {
        autoSave: true,
        autoSaveInterval: 30,
        spellCheck: true,
        grammarCheck: false,
        aiAssistance: true,
        collaborationEnabled: false,
        exportFormats: ['PDF', 'DOCX'],
        backupEnabled: true,
        versionControl: false,
      },
      lastAccessedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      statistics: {
        create: {
          totalWords: 8200,
          totalChapters: 3,
          completedChapters: 2,
          averageWordsPerChapter: 2733,
          writingStreak: 5,
          totalWritingTime: 480, // 8 hours in minutes
          sessionsCount: 12,
          lastWritingSession: new Date(Date.now() - 24 * 60 * 60 * 1000),
          progressPercentage: 54.7,
          dailyWordCounts: [
            {
              date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
              wordsWritten: 500,
              timeSpent: 45,
              chaptersWorked: 1,
            },
            {
              date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
              wordsWritten: 300,
              timeSpent: 30,
              chaptersWorked: 1,
            },
            {
              date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
              wordsWritten: 400,
              timeSpent: 35,
              chaptersWorked: 1,
            },
          ],
        },
      },
    },
  })

  const project3 = await prisma.project.create({
    data: {
      id: 'project_3',
      userId: sampleUser2.id,
      title: 'Quantum Echoes',
      description:
        'First book in the Temporal Nexus trilogy. A physicist discovers parallel dimensions bleeding into reality.',
      genre: 'Science Fiction',
      targetWordCount: 95000,
      currentWordCount: 67800,
      status: 'IN_PROGRESS',
      visibility: 'PRIVATE',
      tags: ['sci-fi', 'quantum-physics', 'parallel-dimensions', 'thriller'],
      settings: {
        autoSave: true,
        autoSaveInterval: 30,
        spellCheck: true,
        grammarCheck: true,
        aiAssistance: true,
        collaborationEnabled: true,
        exportFormats: ['PDF', 'DOCX', 'EPUB', 'HTML'],
        backupEnabled: true,
        versionControl: true,
      },
      lastAccessedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      statistics: {
        create: {
          totalWords: 67800,
          totalChapters: 18,
          completedChapters: 14,
          averageWordsPerChapter: 3767,
          writingStreak: 28,
          totalWritingTime: 4200, // 70 hours in minutes
          sessionsCount: 42,
          lastWritingSession: new Date(Date.now() - 30 * 60 * 1000),
          progressPercentage: 71.4,
          dailyWordCounts: [
            {
              date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
              wordsWritten: 2100,
              timeSpent: 150,
              chaptersWorked: 2,
            },
            {
              date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
              wordsWritten: 1800,
              timeSpent: 120,
              chaptersWorked: 1,
            },
            {
              date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
              wordsWritten: 2300,
              timeSpent: 180,
              chaptersWorked: 2,
            },
            {
              date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
              wordsWritten: 1900,
              timeSpent: 135,
              chaptersWorked: 1,
            },
            {
              date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
              wordsWritten: 2200,
              timeSpent: 165,
              chaptersWorked: 2,
            },
            {
              date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
              wordsWritten: 1700,
              timeSpent: 110,
              chaptersWorked: 1,
            },
          ],
        },
      },
    },
  })

  // Create sample billing transactions
  console.log('💳 Creating sample billing transactions...')

  // Get the created subscriptions to reference in billing transactions
  const user1Subscription = await prisma.subscription.findUnique({
    where: { userId: sampleUser1.id },
  })

  const user2Subscription = await prisma.subscription.findUnique({
    where: { userId: sampleUser2.id },
  })

  await prisma.billingTransaction.create({
    data: {
      userId: sampleUser1.id,
      subscriptionId: user1Subscription?.id,
      amount: 19.99,
      currency: 'USD',
      status: 'COMPLETED',
      description: 'Premium Plan - Monthly Subscription',
      processedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    },
  })

  await prisma.billingTransaction.create({
    data: {
      userId: sampleUser2.id,
      subscriptionId: user2Subscription?.id,
      amount: 39.99,
      currency: 'USD',
      status: 'COMPLETED',
      description: 'Professional Plan - Monthly Subscription',
      processedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    },
  })

  console.log('✅ Database seeding completed successfully!')
  console.log(`
📊 Seeded data summary:
- ${3} subscription plans (Free, Premium, Professional)
- ${3} users (1 admin, 2 sample users)
- ${3} projects with statistics
- ${2} active subscriptions with usage metrics
- ${2} billing transactions

🚀 Your QuillHaven development database is ready!
  `)
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
