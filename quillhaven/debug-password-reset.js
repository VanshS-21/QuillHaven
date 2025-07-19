const { validatePasswordReset } = require('./src/utils/validation/auth');

// Test the validation function directly
const testData = {
  token: 'reset-token',
  password: 'NewSecurePass123!',
  confirmPassword: 'NewSecurePass123!'
};

console.log('Testing password reset validation:');
console.log('Input data:', testData);

const result = validatePasswordReset(testData);
console.log('Validation result:', result);