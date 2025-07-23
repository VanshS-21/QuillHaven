/**
 * Database Connection Test
 *
 * Simple utility to test database connectivity before running migrations or seeds
 */

import { PrismaClient } from '../src/generated/prisma'

const prisma = new PrismaClient()

async function testConnection() {
  try {
    console.log('🔍 Testing database connection...')

    // Test basic connection
    await prisma.$connect()
    console.log('✅ Database connection successful')

    // Test query execution
    const result = await prisma.$queryRaw`SELECT version()`
    console.log('✅ Database query successful')
    console.log('📊 Database info:', result)

    // Test table access (if tables exist)
    try {
      const userCount = await prisma.user.count()
      console.log(`✅ User table accessible (${userCount} users)`)
    } catch (error) {
      console.log('⚠️  User table not found (run db:push first)')
    }

    console.log('🎉 Database connection test completed successfully!')
  } catch (error) {
    console.error('❌ Database connection failed:', error)
    console.log('\n🔧 Troubleshooting steps:')
    console.log('1. Check DATABASE_URL in .env file')
    console.log('2. Verify Supabase project is active')
    console.log('3. Ensure database password is correct')
    console.log('4. Check IP whitelist in Supabase settings')
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

testConnection()
