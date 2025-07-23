/**
 * Database Migration Script
 *
 * This script runs database migrations using Prisma.
 * It can be used in CI/CD pipelines or manually to apply migrations.
 */

import { execSync } from 'child_process'
import path from 'path'

// Define the migration command
const MIGRATE_COMMAND = 'npx prisma migrate deploy'

/**
 * Run database migrations
 */
async function runMigrations() {
  try {
    console.log('Running database migrations...')

    // Execute the migration command
    execSync(MIGRATE_COMMAND, {
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '../../'),
    })

    console.log('Database migrations completed successfully.')

    // Generate Prisma client
    console.log('Generating Prisma client...')
    execSync('npx prisma generate', {
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '../../'),
    })

    console.log('Prisma client generated successfully.')

    return true
  } catch (error) {
    console.error('Error running database migrations:', error)
    return false
  }
}

// Run migrations if this script is executed directly
if (require.main === module) {
  runMigrations()
    .then((success) => {
      process.exit(success ? 0 : 1)
    })
    .catch((error) => {
      console.error('Unhandled error:', error)
      process.exit(1)
    })
}

export { runMigrations }
