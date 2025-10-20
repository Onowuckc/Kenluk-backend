import fetch from 'node-fetch';

const API_BASE = 'https://kenluk-backend-production.up.railway.app/api';

async function testAdminLogin() {
  console.log('🧪 Testing Admin Login Endpoint...\n');

  const payload = {
    email: 'admin@kenlukapp.com',
    password: 'Admin123!'
  };

  try {
    console.log('📤 Sending POST request to /api/auth/admin/login');
    console.log('📋 Payload:', JSON.stringify(payload, null, 2));

    const response = await fetch(`${API_BASE}/auth/admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    console.log(`📊 Response Status: ${response.status} ${response.statusText}`);

    const responseData = await response.json();
    console.log('📋 Response Data:');
    console.log(JSON.stringify(responseData, null, 2));

    if (response.ok && responseData.success) {
      console.log('\n✅ Admin login test PASSED!');
      console.log('🎉 Admin can successfully log in');
    } else {
      console.log('\n❌ Admin login test FAILED!');
      console.log('💥 Error:', responseData.message || 'Unknown error');
    }

  } catch (error) {
    console.error('\n💥 Test failed with exception:', error.message);
  }
}

// Test health endpoint first
async function testHealth() {
  console.log('🏥 Testing Health Endpoint...\n');

  try {
    const response = await fetch(`${API_BASE}/health`);
    const data = await response.json();

    console.log(`📊 Health Status: ${response.status}`);
    console.log('📋 Health Response:', JSON.stringify(data, null, 2));

    if (response.ok && data.success) {
      console.log('✅ Health check passed\n');
      return true;
    } else {
      console.log('❌ Health check failed\n');
      return false;
    }
  } catch (error) {
    console.error('💥 Health check error:', error.message);
    return false;
  }
}

// Run tests
async function runTests() {
  const healthOk = await testHealth();
  if (healthOk) {
    await testAdminLogin();
  } else {
    console.log('⏭️  Skipping admin login test due to health check failure');
  }
}

runTests();
