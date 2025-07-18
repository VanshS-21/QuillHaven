#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up QuillHaven development environment...\n');

// Check if .env file exists
const envPath = path.join(__dirname, '..', '.env');
if (!fs.existsSync(envPath)) {
  console.log('📝 Creating .env file from .env.example...');
  const envExamplePath = path.join(__dirname, '..', '.env.example');
  fs.copyFileSync(envExamplePath, envPath);
  console.log(
    '✅ .env file created. Please update it with your actual values.\n'
  );
}

try {
  // Start Docker containers
  console.log('🐳 Starting Docker containers...');
  execSync('docker-compose up -d', {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
  });
  console.log('✅ Docker containers started.\n');

  // Wait for database to be ready
  console.log('⏳ Waiting for database to be ready...');
  let retries = 30;
  while (retries > 0) {
    try {
      execSync(
        'docker-compose exec -T postgres pg_isready -U quillhaven -d quillhaven',
        {
          stdio: 'pipe',
          cwd: path.join(__dirname, '..'),
        }
      );
      break;
    } catch (error) {
      retries--;
      if (retries === 0) {
        throw new Error('Database failed to start after 30 attempts');
      }
      process.stdout.write('.');
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  console.log('\n✅ Database is ready.\n');

  // Generate Prisma client
  console.log('🔧 Generating Prisma client...');
  execSync('npx prisma generate', {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
  });
  console.log('✅ Prisma client generated.\n');

  // Run database migrations
  console.log('📊 Running database migrations...');
  execSync('npx prisma migrate dev --name init', {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
  });
  console.log('✅ Database migrations completed.\n');

  console.log('🎉 Development environment setup complete!');
  console.log('You can now run: npm run dev');
} catch (error) {
  console.error('❌ Setup failed:', error.message);
  process.exit(1);
}
