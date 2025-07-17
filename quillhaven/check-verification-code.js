// Script to check the verification code for a user
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkVerificationCode() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: 'test@example.com' },
      select: {
        id: true,
        email: true,
        emailVerificationToken: true,
        emailVerified: true,
      },
    });

    if (user) {
      console.log('User found:');
      console.log(`ID: ${user.id}`);
      console.log(`Email: ${user.email}`);
      console.log(`Verification Code: ${user.emailVerificationToken}`);
      console.log(`Email Verified: ${user.emailVerified}`);
    } else {
      console.log('User not found');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkVerificationCode();