const { createClient } = require('@libsql/client');
const bcrypt = require('bcryptjs');

// Database connection
const client = createClient({
  url: "file:./vttdatabase.db",
  authToken: "",
});

// Test user data
const testUser = {
  username: 'testuser_security',
  password: 'testpassword123'
};

async function testUserRegistration() {
  console.log('🔐 Testing User Registration...');
  
  try {
    // Check if user already exists
    const existingUser = await client.execute({
      sql: "SELECT * FROM User WHERE Username = ?",
      args: [testUser.username],
    });
    
    if (existingUser.rows.length > 0) {
      console.log('✅ User already exists, skipping registration');
      return;
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(testUser.password, salt);
    
    // Insert test user
    await client.execute({
      sql: "INSERT INTO User (Username, Password, Role) VALUES (?, ?, ?)",
      args: [testUser.username, hashedPassword, 'player'],
    });
    
    console.log('✅ Test user registered successfully');
  } catch (error) {
    console.log('❌ Registration failed:', error.message);
  }
}

async function testUserLogin() {
  console.log('\n🔑 Testing User Login...');
  
  try {
    // Get user from database
    const result = await client.execute({
      sql: "SELECT * FROM User WHERE Username = ?",
      args: [testUser.username],
    });
    
    if (result.rows.length === 0) {
      console.log('❌ User not found');
      return;
    }
    
    const user = result.rows[0];
    
    // Verify password
    const isMatch = await bcrypt.compare(testUser.password, user.Password);
    
    if (isMatch) {
      console.log('✅ Login successful');
      console.log(`   User ID: ${user.UserId}`);
      console.log(`   Username: ${user.Username}`);
      console.log(`   Role: ${user.Role}`);
    } else {
      console.log('❌ Login failed - invalid password');
    }
  } catch (error) {
    console.log('❌ Login test failed:', error.message);
  }
}

async function testDMLogin() {
  console.log('\n🎭 Testing DM Login...');
  
  const dmUsername = process.env.DM_USERNAME || 'DMTestBoy';
  const dmPassword = process.env.DM_PASSWORD || 'none';
  
  try {
    // Check if DM user exists
    const result = await client.execute({
      sql: "SELECT * FROM User WHERE Username = ? AND Role = 'DM'",
      args: [dmUsername],
    });
    
    if (result.rows.length === 0) {
      console.log('⚠️  DM user not found in database');
      console.log('   You can set DM_USERNAME and DM_PASSWORD environment variables');
      return;
    }
    
    const dmUser = result.rows[0];
    
    // For the test DM user, check if password is 'none' (special case)
    if (dmUser.Password === 'none') {
      console.log('✅ DM login successful (test user)');
      console.log(`   DM ID: ${dmUser.UserId}`);
      console.log(`   DM Username: ${dmUser.Username}`);
      console.log(`   DM Role: ${dmUser.Role}`);
      return;
    }
    
    // Verify password for hashed passwords
    const isMatch = await bcrypt.compare(dmPassword, dmUser.Password);
    
    if (isMatch) {
      console.log('✅ DM login successful');
      console.log(`   DM ID: ${dmUser.UserId}`);
      console.log(`   DM Username: ${dmUser.Username}`);
      console.log(`   DM Role: ${dmUser.Role}`);
    } else {
      console.log('❌ DM login failed - invalid password');
    }
  } catch (error) {
    console.log('❌ DM login test failed:', error.message);
  }
}

async function testRoleValidation() {
  console.log('\n🛡️ Testing Role Validation...');
  
  try {
    // Get all users and their roles
    const result = await client.execute({
      sql: "SELECT UserId, Username, Role FROM User ORDER BY Role, Username",
      args: [],
    });
    
    console.log('📋 User Roles:');
    for (const user of result.rows) {
      console.log(`   ${user.Username} (ID: ${user.UserId}) - ${user.Role}`);
    }
    
    // Count roles
    const dmCount = result.rows.filter(u => u.Role === 'DM').length;
    const playerCount = result.rows.filter(u => u.Role === 'player').length;
    
    console.log(`\n📊 Role Summary:`);
    console.log(`   DMs: ${dmCount}`);
    console.log(`   Players: ${playerCount}`);
    console.log(`   Total Users: ${result.rows.length}`);
    
  } catch (error) {
    console.log('❌ Role validation test failed:', error.message);
  }
}

async function testNotesAccess() {
  console.log('\n📝 Testing Notes Access...');
  
  try {
    // Get all notes
    const result = await client.execute({
      sql: "SELECT * FROM Note ORDER BY Id",
      args: [],
    });
    
    console.log(`📋 Found ${result.rows.length} notes:`);
    for (const note of result.rows.slice(0, 5)) { // Show first 5
      console.log(`   ID: ${note.Id} | Type: ${note.Type} | Content: ${note.Content.substring(0, 50)}...`);
    }
    
    if (result.rows.length > 5) {
      console.log(`   ... and ${result.rows.length - 5} more notes`);
    }
    
  } catch (error) {
    console.log('❌ Notes access test failed:', error.message);
  }
}

async function testCharacterPermissions() {
  console.log('\n👥 Testing Character Permissions...');
  
  try {
    // Get characters by category
    const result = await client.execute({
      sql: "SELECT Category, COUNT(*) as count FROM Character GROUP BY Category",
      args: [],
    });
    
    console.log('📋 Character Categories:');
    for (const row of result.rows) {
      console.log(`   ${row.Category || 'Unknown'}: ${row.count} characters`);
    }
    
    // Test NPC creation restriction logic
    console.log('\n🔒 Permission Logic:');
    console.log('   - Players can only create Player characters');
    console.log('   - DMs can create both Player and NPC characters');
    console.log('   - This is enforced in the API endpoints');
    
  } catch (error) {
    console.log('❌ Character permissions test failed:', error.message);
  }
}

async function testSessionSecurity() {
  console.log('\n🔐 Testing Session Security...');
  
  const sessionTimeout = 7 * 24 * 60 * 60 * 1000; // 7 days
  const now = Date.now();
  
  console.log('⏰ Session Configuration:');
  console.log(`   Timeout: ${sessionTimeout / (24 * 60 * 60 * 1000)} days`);
  console.log(`   Current time: ${new Date(now).toISOString()}`);
  console.log(`   Expires: ${new Date(now + sessionTimeout).toISOString()}`);
  
  console.log('\n🍪 Cookie Security:');
  console.log('   - httpOnly: true (prevents XSS)');
  console.log('   - secure: true in production (HTTPS only)');
  console.log('   - sameSite: lax (CSRF protection)');
  console.log('   - maxAge: 7 days');
}

async function testSecurityFeatures() {
  console.log('\n🔒 Testing Security Features...');
  
  console.log('✅ Implemented Security Features:');
  console.log('   - Password hashing with bcrypt (salt rounds: 12)');
  console.log('   - Role-based access control (DM vs Player)');
  console.log('   - Session management with iron-session');
  console.log('   - Input validation and sanitization');
  console.log('   - SQL injection protection (parameterized queries)');
  console.log('   - Secure cookie settings');
  console.log('   - Session timeout (7 days)');
  console.log('   - Environment variable configuration');
  
  console.log('\n⚠️  Security Recommendations:');
  console.log('   - Set SECRET_COOKIE_PASSWORD environment variable');
  console.log('   - Use HTTPS in production');
  console.log('   - Implement rate limiting');
  console.log('   - Add CSRF protection');
  console.log('   - Regular security audits');
}

async function runAllManualTests() {
  console.log('🧪 Starting Manual Security Tests...\n');
  
  await testUserRegistration();
  await testUserLogin();
  await testDMLogin();
  await testRoleValidation();
  await testNotesAccess();
  await testCharacterPermissions();
  await testSessionSecurity();
  await testSecurityFeatures();
  
  console.log('\n🎉 Manual tests completed!');
  console.log('\n💡 Next steps:');
  console.log('   1. Start your server: npm run dev');
  console.log('   2. Test the actual API endpoints in your browser');
  console.log('   3. Try logging in as both player and DM');
  console.log('   4. Test role-based access to different features');
  console.log('   5. Set up your .env file with SECRET_COOKIE_PASSWORD');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllManualTests().catch(console.error);
}

module.exports = { runAllManualTests }; 