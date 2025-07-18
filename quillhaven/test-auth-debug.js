const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function testAuth() {
  try {
    console.log('🔍 Testing authentication...');

    // Find the test user
    const user = await prisma.user.findUnique({
      where: { email: 'test@quillhaven.com' },
    });

    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log('✅ User found:', {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      emailVerified: user.emailVerified,
      hasPasswordHash: !!user.passwordHash,
    });

    // Test password comparison
    const testPassword = 'TestPass123!';
    const isValid = await bcrypt.compare(testPassword, user.passwordHash);

    console.log(
      '🔐 Password test result:',
      isValid ? '✅ Valid' : '❌ Invalid'
    );

    if (!isValid) {
      // Test with old password
      const oldPassword = 'password123';
      const isOldValid = await bcrypt.compare(oldPassword, user.passwordHash);
      console.log(
        '🔐 Old password test result:',
        isOldValid ? '✅ Valid' : '❌ Invalid'
      );
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAuth();
