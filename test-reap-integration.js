import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();


// Test script to validate Reap Pay API integration
async function testReapIntegration() {
  console.log('Testing Reap Pay API integration...\n');

  // Test payload structure (mock data) - corrected based on Reap API Postman collection
  const testPayload = {
    receivingParty: {
      type: 'company',
      name: {
        name: 'Test Company Ltd'
      },
      accounts: [
        {
          type: 'bank',
          identifier: {
            standard: 'account_number',
            value: '888231234112'
          },
          network: 'FPS',
          currencies: ['HKD'],
          provider: {
            name: 'HSBC HK',
            country: 'HK',
            networkIdentifier: '004'
          },
          addresses: [
            {
              type: 'postal',
              street: 'Flat A, 2/F, Beauty Avenue',
              city: 'Quarry Bay',
              state: 'HK Island',
              country: 'HK',
              postalCode: '999077'
            }
          ]
        }
      ]
    },
    payment: {
      receivingAmount: 2000,
      receivingCurrency: 'HKD',
      senderCurrency: 'USDC',
      description: 'Payment for FPS',
      purposeOfPayment: 'payment_for_goods',
      metadata: {
        key: 'test'
      }
    }
  };

  const reapUrl = process.env.REAP_PAYMENT_API_URL || 'https://payments.reap.global/api/payments';
  const apiKey = process.env.REAP_PAYMENT_API_KEY;
  const entityId = process.env.REAP_ENTITY_ID;

  console.log('Environment variables:');
  console.log('- REAP_PAYMENT_API_URL:', reapUrl);
  console.log('- REAP_PAYMENT_API_KEY:', apiKey ? '***' + apiKey.slice(-4) : 'NOT SET');
  console.log('- REAP_ENTITY_ID:', entityId ? '***' + entityId.slice(-4) : 'NOT SET');
  console.log('');

  if (!apiKey || !entityId) {
    console.error('❌ Missing required environment variables: REAP_PAYMENT_API_KEY or REAP_ENTITY_ID');
    return;
  }

  try {
    console.log('Sending test payload to Reap API...');
    console.log('Payload:', JSON.stringify(testPayload, null, 2));
    console.log('');

    const response = await fetch(reapUrl, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'x-reap-api-key': apiKey,
        'x-reap-entity-id': entityId
      },
      body: JSON.stringify(testPayload)
    });

    const responseData = await response.json();

    console.log('Response Status:', response.status);
    console.log('Response Data:', JSON.stringify(responseData, null, 2));

    if (response.ok) {
      console.log('\n✅ SUCCESS: Reap API accepted the payload!');
      console.log('Payment ID:', responseData.paymentId);
    } else {
      console.log('\n❌ FAILED: Reap API rejected the payload');
      console.log('Error:', responseData.message || 'Unknown error');
    }

  } catch (error) {
    console.error('\n❌ ERROR: Failed to connect to Reap API');
    console.error('Error details:', error.message);
  }
}

// Run the test
testReapIntegration().catch(console.error);
