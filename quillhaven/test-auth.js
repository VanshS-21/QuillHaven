// Simple test script to verify authentication endpoints
const BASE_URL = 'http://localhost:3000';

async function testEndpoint(url, options = {}) {
  try {
    console.log(`Testing ${options.method || 'GET'} ${url}`);
    const response = await fetch(url, options);
    const data = await response.json();
    console.log(`Status: ${response.status}`);
    console.log(`Response:`, data);
    console.log('---');
    return { response, data };
  } catch (error) {
    console.error(`Error testing ${url}:`, error.message);
    console.log('---');
    return { error };
  }
}

async function runTests() {
  console.log('🧪 Testing QuillHaven Authentication System\n');

  // Test 1: Health Check
  console.log('1. Health Check');
  await testEndpoint(`${BASE_URL}/api/health`);

  // Test 2: Registration
  console.log('2. User Registration');
  const testUser = {
    email: 'test@example.com',
    password: 'testpass123',
    confirmPassword: 'testpass123',
    firstName: 'Test',
    lastName: 'User',
  };

  const registerResult = await testEndpoint(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(testUser),
  });

  // Test 3: Login (if registration succeeded)
  if (registerResult.response && registerResult.response.status === 201) {
    console.log('3. User Login');
    await testEndpoint(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: testUser.email,
        password: testUser.password,
      }),
    });
  } else {
    console.log('3. Skipping login test (registration failed)');
  }

  // Test 4: Email Verification
  console.log('4. Email Verification (with test code)');
  await testEndpoint(`${BASE_URL}/api/auth/verify-email?token=123456`);

  // Test 5: Password Reset Request
  console.log('5. Password Reset Request');
  await testEndpoint(`${BASE_URL}/api/auth/forgot-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: testUser.email,
    }),
  });

  console.log('✅ Test completed!');
}

runTests().catch(console.error);
