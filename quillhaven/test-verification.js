// Test email verification with the correct code
const BASE_URL = 'http://localhost:3000';

async function testVerification() {
  console.log('🧪 Testing Email Verification with correct code\n');

  try {
    console.log('Testing verification with code: 968123');
    const response = await fetch(`${BASE_URL}/api/auth/verify-email?token=968123`);
    const data = await response.json();
    
    console.log(`Status: ${response.status}`);
    console.log(`Response:`, data);
    
    if (response.status === 200) {
      console.log('✅ Email verification successful!');
    } else {
      console.log('❌ Email verification failed');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testVerification();