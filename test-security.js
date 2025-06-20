const fetch = require('node-fetch');

// Test configuration
const BASE_URL = 'http://localhost:3000';
const TEST_USER = {
  username: 'testuser',
  password: 'testpassword123'
};

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

// Test 1: Registration with valid data
async function testValidRegistration() {
  const response = await fetch(`${BASE_URL}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(TEST_USER)
  });
  
  if (response.status === 200) {
    const data = await response.json();
    if (data.message === 'User registered successfully') {
      return;
    }
  }
  throw new Error(`Expected 200, got ${response.status}`);
}

// Test 2: Registration with invalid data
async function testInvalidRegistration() {
  const response = await fetch(`${BASE_URL}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'ab', password: '123' })
  });
  
  if (response.status === 400) {
    const data = await response.json();
    if (data.error && data.error.includes('Username must be between 3 and 50 characters')) {
      return;
    }
  }
  throw new Error(`Expected 400 for invalid registration, got ${response.status}`);
}

// Test 3: Login with valid credentials
async function testValidLogin() {
  const response = await fetch(`${BASE_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(TEST_USER)
  });
  
  if (response.status === 200) {
    const data = await response.json();
    if (data.message === 'Logged in successfully') {
      return response.headers.get('set-cookie');
    }
  }
  throw new Error(`Expected 200, got ${response.status}`);
}

// Test 4: Login with invalid credentials
async function testInvalidLogin() {
  const response = await fetch(`${BASE_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'wronguser', password: 'wrongpass' })
  });
  
  if (response.status === 401) {
    const data = await response.json();
    if (data.error === 'Invalid credentials') {
      return;
    }
  }
  throw new Error(`Expected 401 for invalid login, got ${response.status}`);
}

// Test 5: DM login with environment variables
async function testDMLogin() {
  const response = await fetch(`${BASE_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: process.env.DM_USERNAME || 'DM_User',
      password: process.env.DM_PASSWORD || 'dm_password'
    })
  });
  
  if (response.status === 200) {
    const data = await response.json();
    if (data.message === 'Logged in successfully' && data.role === 'DM') {
      return response.headers.get('set-cookie');
    }
  }
  throw new Error(`Expected 200 for DM login, got ${response.status}`);
}

// Test 6: Access protected endpoint without authentication
async function testUnauthenticatedAccess() {
  const response = await fetch(`${BASE_URL}/api/notes`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: 'test note' })
  });
  
  if (response.status === 401) {
    const data = await response.json();
    if (data.error === 'Unauthorized') {
      return;
    }
  }
  throw new Error(`Expected 401 for unauthenticated access, got ${response.status}`);
}

// Test 7: Access DM-only endpoint as player
async function testPlayerAccessToDMEndpoint() {
  // First login as regular user
  const loginResponse = await fetch(`${BASE_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(TEST_USER)
  });
  
  const cookies = loginResponse.headers.get('set-cookie');
  
  // Try to access DM-only endpoint
  const response = await fetch(`${BASE_URL}/api/notes`, {
    method: 'PUT',
    headers: { 
      'Content-Type': 'application/json',
      'Cookie': cookies
    },
    body: JSON.stringify({ content: 'test note' })
  });
  
  if (response.status === 403) {
    const data = await response.json();
    if (data.error && data.error.includes('Only DMs can edit notes')) {
      return;
    }
  }
  throw new Error(`Expected 403 for player accessing DM endpoint, got ${response.status}`);
}

// Test 8: Input validation for notes
async function testNotesInputValidation() {
  // Login as DM first
  const loginResponse = await fetch(`${BASE_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: process.env.DM_USERNAME || 'DM_User',
      password: process.env.DM_PASSWORD || 'dm_password'
    })
  });
  
  const cookies = loginResponse.headers.get('set-cookie');
  
  // Test empty content
  const response1 = await fetch(`${BASE_URL}/api/notes`, {
    method: 'PUT',
    headers: { 
      'Content-Type': 'application/json',
      'Cookie': cookies
    },
    body: JSON.stringify({ content: '' })
  });
  
  if (response1.status !== 400) {
    throw new Error(`Expected 400 for empty content, got ${response1.status}`);
  }
  
  // Test invalid content type
  const response2 = await fetch(`${BASE_URL}/api/notes`, {
    method: 'PUT',
    headers: { 
      'Content-Type': 'application/json',
      'Cookie': cookies
    },
    body: JSON.stringify({ content: 123 })
  });
  
  if (response2.status !== 400) {
    throw new Error(`Expected 400 for invalid content type, got ${response2.status}`);
  }
  
  return;
}

// Test 9: Character creation permissions
async function testCharacterCreationPermissions() {
  // Login as regular user
  const loginResponse = await fetch(`${BASE_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(TEST_USER)
  });
  
  const cookies = loginResponse.headers.get('set-cookie');
  
  // Try to create NPC as player (should fail)
  const response = await fetch(`${BASE_URL}/api/characters`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Cookie': cookies
    },
    body: JSON.stringify({ category: 'NPC' })
  });
  
  if (response.status === 403) {
    const data = await response.json();
    if (data.error && data.error.includes('Only DMs can create NPCs')) {
      return;
    }
  }
  throw new Error(`Expected 403 for player creating NPC, got ${response.status}`);
}

// Test 10: Session timeout simulation
async function testSessionTimeout() {
  // This test would require modifying the session timestamp in the cookie
  // For now, we'll just test that the session validation works
  const response = await fetch(`${BASE_URL}/api/user`, {
    headers: { 'Cookie': 'user=invalid-json' }
  });
  
  if (response.status === 401) {
    return;
  }
  throw new Error(`Expected 401 for invalid session, got ${response.status}`);
}

// Main test runner
async function runAllTests() {
  console.log('🔒 Starting Security Tests...\n');
  
  await runTest('Valid Registration', testValidRegistration);
  await runTest('Invalid Registration Validation', testInvalidRegistration);
  await runTest('Valid Login', testValidLogin);
  await runTest('Invalid Login Rejection', testInvalidLogin);
  await runTest('DM Login with Environment Variables', testDMLogin);
  await runTest('Unauthenticated Access Blocked', testUnauthenticatedAccess);
  await runTest('Player Access to DM Endpoints Blocked', testPlayerAccessToDMEndpoint);
  await runTest('Notes Input Validation', testNotesInputValidation);
  await runTest('Character Creation Permissions', testCharacterCreationPermissions);
  await runTest('Session Validation', testSessionTimeout);
  
  console.log('\n📊 Test Results:');
  console.log(`✅ Passed: ${testsPassed}`);
  console.log(`❌ Failed: ${testsFailed}`);
  console.log(`📈 Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);
  
  if (testsFailed === 0) {
    console.log('\n🎉 All security tests passed! Your authentication and authorization system is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the security implementation.');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { runAllTests }; 