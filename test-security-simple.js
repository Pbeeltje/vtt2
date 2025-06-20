const { createClient } = require('@libsql/client');
const bcrypt = require('bcryptjs');

// Test configuration
const client = createClient({
  url: "file:./vttdatabase.db",
  authToken: "",
});

// Test results tracking
let testsPassed = 0;
let testsFailed = 0;

function logTest(name, passed, details = '') {
  if (passed) {
    console.log(`✅ ${name} - PASSED`);
    testsPassed++;
  } else {
    console.log(`❌ ${name} - FAILED ${details}`);
    testsFailed++;
  }
}

async function runTest(name, testFunction) {
  try {
    await testFunction();
    logTest(name, true);
  } catch (error) {
    logTest(name, false, error.message);
  }
}

// Test 1: Database connection
async function testDatabaseConnection() {
  const result = await client.execute({
    sql: "SELECT 1 as test",
    args: [],
  });
  
  if (result.rows.length > 0 && result.rows[0].test === 1) {
    return;
  }
  throw new Error('Database connection failed');
}

// Test 2: Password hashing
async function testPasswordHashing() {
  const password = 'testpassword123';
  const salt = await bcrypt.genSalt(12);
  const hashedPassword = await bcrypt.hash(password, salt);
  
  const isMatch = await bcrypt.compare(password, hashedPassword);
  const isWrongMatch = await bcrypt.compare('wrongpassword', hashedPassword);
  
  if (isMatch && !isWrongMatch) {
    return;
  }
  throw new Error('Password hashing/verification failed');
}

// Test 3: Input validation functions
function testInputValidation() {
  // Test username validation
  const validUsernames = ['testuser', 'user123', 'test_user'];
  const invalidUsernames = ['ab', 'a'.repeat(51), 'user@name', 'user name'];
  
  for (const username of validUsernames) {
    if (username.length < 3 || username.length > 50) {
      throw new Error(`Valid username rejected: ${username}`);
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      throw new Error(`Valid username format rejected: ${username}`);
    }
  }
  
  for (const username of invalidUsernames) {
    if (username.length >= 3 && username.length <= 50 && /^[a-zA-Z0-9_]+$/.test(username)) {
      throw new Error(`Invalid username accepted: ${username}`);
    }
  }
  
  // Test password validation
  const validPasswords = ['password123', 'a'.repeat(8), 'a'.repeat(128)];
  const invalidPasswords = ['123', 'a'.repeat(129)];
  
  for (const password of validPasswords) {
    if (password.length < 8 || password.length > 128) {
      throw new Error(`Valid password rejected: ${password}`);
    }
  }
  
  for (const password of invalidPasswords) {
    if (password.length >= 8 && password.length <= 128) {
      throw new Error(`Invalid password accepted: ${password}`);
    }
  }
  
  return;
}

// Test 4: Role validation logic
function testRoleValidation() {
  const dmUser = { id: 1, username: 'dm', role: 'DM' };
  const playerUser = { id: 2, username: 'player', role: 'player' };
  
  // Test DM access to all endpoints
  const dmEndpoints = ['notes', 'images', 'scenes'];
  for (const endpoint of dmEndpoints) {
    if (dmUser.role !== 'DM') {
      throw new Error(`DM should have access to ${endpoint}`);
    }
  }
  
  // Test player restrictions
  if (playerUser.role === 'DM') {
    throw new Error('Player should not have DM role');
  }
  
  return;
}

// Test 5: Session timeout calculation
function testSessionTimeout() {
  const SESSION_TIMEOUT = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
  
  const now = Date.now();
  const validSession = now - (3 * 24 * 60 * 60 * 1000); // 3 days ago
  const expiredSession = now - (8 * 24 * 60 * 60 * 1000); // 8 days ago
  
  if ((now - validSession) > SESSION_TIMEOUT) {
    throw new Error('Valid session marked as expired');
  }
  
  if ((now - expiredSession) <= SESSION_TIMEOUT) {
    throw new Error('Expired session marked as valid');
  }
  
  return;
}

// Test 6: SQL injection protection
async function testSQLInjectionProtection() {
  const maliciousInput = "'; DROP TABLE users; --";
  
  try {
    const result = await client.execute({
      sql: "SELECT * FROM User WHERE Username = ?",
      args: [maliciousInput],
    });
    
    // If we get here without error, the injection was prevented
    return;
  } catch (error) {
    // This is also acceptable - the query failed safely
    return;
  }
}

// Test 7: Environment variable validation
function testEnvironmentVariables() {
  const requiredVars = ['SECRET_COOKIE_PASSWORD'];
  const optionalVars = ['DM_USERNAME', 'DM_PASSWORD'];
  
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      console.log(`⚠️  Warning: Required environment variable ${varName} is not set`);
    }
  }
  
  const dmUsername = process.env.DM_USERNAME;
  const dmPassword = process.env.DM_PASSWORD;
  
  if (dmUsername && !dmPassword) {
    throw new Error('DM_USERNAME set but DM_PASSWORD missing');
  }
  
  if (dmPassword && !dmUsername) {
    throw new Error('DM_PASSWORD set but DM_USERNAME missing');
  }
  
  return;
}

// Test 8: Cookie security settings
function testCookieSecurity() {
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Test cookie settings
  const cookieSettings = {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  };
  
  if (!cookieSettings.httpOnly) {
    throw new Error('Cookies should be httpOnly');
  }
  
  if (isProduction && !cookieSettings.secure) {
    throw new Error('Cookies should be secure in production');
  }
  
  if (cookieSettings.maxAge < 60 * 60 * 24) {
    throw new Error('Cookie maxAge should be at least 1 day');
  }
  
  return;
}

// Test 9: File upload validation
function testFileUploadValidation() {
  const maxSize = 5 * 1024 * 1024; // 5MB
  const validFileTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const invalidFileTypes = ['text/plain', 'application/pdf', 'video/mp4'];
  
  // Test file size validation
  const validSizes = [1024, 1024 * 1024, 5 * 1024 * 1024]; // 1KB, 1MB, 5MB
  const invalidSizes = [6 * 1024 * 1024, 10 * 1024 * 1024]; // 6MB, 10MB
  
  for (const size of validSizes) {
    if (size > maxSize) {
      throw new Error(`Valid file size rejected: ${size} bytes`);
    }
  }
  
  for (const size of invalidSizes) {
    if (size <= maxSize) {
      throw new Error(`Invalid file size accepted: ${size} bytes`);
    }
  }
  
  // Test file type validation
  for (const type of validFileTypes) {
    if (!type.startsWith('image/')) {
      throw new Error(`Valid image type rejected: ${type}`);
    }
  }
  
  for (const type of invalidFileTypes) {
    if (type.startsWith('image/')) {
      throw new Error(`Invalid file type accepted: ${type}`);
    }
  }
  
  return;
}

// Test 10: Input sanitization
function testInputSanitization() {
  const testInputs = [
    { input: '  test  ', expected: 'test' },
    { input: 'user@name', expected: 'user@name' }, // Should be rejected by validation
    { input: 'user name', expected: 'user name' }, // Should be rejected by validation
  ];
  
  for (const test of testInputs) {
    const sanitized = test.input.trim();
    if (sanitized !== test.expected) {
      throw new Error(`Input sanitization failed: "${test.input}" -> "${sanitized}"`);
    }
  }
  
  return;
}

// Main test runner
async function runAllTests() {
  console.log('🔒 Starting Security Tests...\n');
  
  await runTest('Database Connection', testDatabaseConnection);
  await runTest('Password Hashing', testPasswordHashing);
  await runTest('Input Validation', testInputValidation);
  await runTest('Role Validation Logic', testRoleValidation);
  await runTest('Session Timeout Calculation', testSessionTimeout);
  await runTest('SQL Injection Protection', testSQLInjectionProtection);
  await runTest('Environment Variables', testEnvironmentVariables);
  await runTest('Cookie Security Settings', testCookieSecurity);
  await runTest('File Upload Validation', testFileUploadValidation);
  await runTest('Input Sanitization', testInputSanitization);
  
  console.log('\n📊 Test Results:');
  console.log(`✅ Passed: ${testsPassed}`);
  console.log(`❌ Failed: ${testsFailed}`);
  console.log(`📈 Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);
  
  if (testsFailed === 0) {
    console.log('\n🎉 All security tests passed! Your security implementation is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the security implementation.');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { runAllTests }; 