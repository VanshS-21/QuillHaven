// Simple test using fetch to test the API endpoints directly
async function testAuth() {
  console.log('Testing authentication system...');

  const testEmail = 'debug2@test.com';
  const testPassword = 'TestPassword123!';

  try {
    // Test registration
    console.log('\n1. Testing registration...');
    const registerResponse = await fetch(
      'http://localhost:3000/api/auth/register',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
          confirmPassword: testPassword,
          firstName: 'Debug',
          lastName: 'User',
        }),
      }
    );

    const registerData = await registerResponse.json();
    console.log('Registration response status:', registerResponse.status);
    console.log('Registration result:', registerData);

    if (registerResponse.ok) {
      console.log('\n2. Testing login with same credentials...');
      const loginResponse = await fetch(
        'http://localhost:3000/api/auth/login',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: testEmail,
            password: testPassword,
          }),
        }
      );

      const loginData = await loginResponse.json();
      console.log('Login response status:', loginResponse.status);
      console.log('Login result:', loginData);
    }
  } catch (error) {
    console.error('Test error:', error);
  }
}

testAuth();
