import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://kenluk-backend-production.up.railway.app/api';

const testAdminLogin = async () => {
  try {
    console.log('🧪 Testing admin login...\n');

    const loginData = {
      email: 'admin@kenlukapp.com',
      password: 'Admin123!'
    };

    console.log('📤 Sending login request to:', `${API_BASE_URL}/auth/admin/login`);
    console.log('📧 Email:', loginData.email);
    console.log('🔒 Password:', loginData.password.replace(/./g, '*'));

    const response = await axios.post(`${API_BASE_URL}/auth/admin/login`, loginData, {
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('\n✅ Login successful!');
    console.log('📊 Response status:', response.status);
    console.log('📋 Response data:');
    console.log(JSON.stringify(response.data, null, 2));

    // Check if tokens are present
    if (response.data.data?.tokens) {
      console.log('\n🔑 Tokens received:');
      console.log('- Access Token:', response.data.data.tokens.accessToken ? '✅ Present' : '❌ Missing');
      console.log('- Refresh Token:', response.data.data.tokens.refreshToken ? '✅ Present' : '❌ Missing');
    }

    // Check user data
    if (response.data.data?.user) {
      console.log('\n👤 User data:');
      console.log('- ID:', response.data.data.user.id);
      console.log('- Name:', response.data.data.user.name);
      console.log('- Email:', response.data.data.user.email);
      console.log('- Role:', response.data.data.user.role);
      console.log('- Verified:', response.data.data.user.isVerified);
    }

  } catch (error) {
    console.log('\n❌ Login failed!');
    console.log('📊 Error status:', error.response?.status);
    console.log('📋 Error message:', error.response?.data?.message || error.message);

    if (error.response?.data?.errors) {
      console.log('🔍 Validation errors:', error.response.data.errors);
    }
  }
};

// Run the test
testAdminLogin();
