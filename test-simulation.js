import 'dotenv/config';
import fetch from 'node-fetch';

const testSimulation = async () => {
  console.log('Testing Reap simulation endpoint...');

  const reapUrl = process.env.REAP_PAYMENT_API_URL || 'https://sandbox.payments.reap.global/api/simulate/balances';
  const apiKey = process.env.REAP_PAYMENT_API_KEY;
  const entityId = process.env.REAP_ENTITY_ID;

  if (!apiKey || !entityId) {
    console.error('Missing REAP_PAYMENT_API_KEY or REAP_ENTITY_ID');
    return;
  }

  const payload = {
    id: 'test-simulation-123',
    currency: 'USDC',
    network: 'Ethereum',
    type: 'fund_in',
    amount: '500'
  };

  console.log('Payload:', JSON.stringify(payload, null, 2));

  try {
    const response = await fetch(reapUrl, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'x-reap-api-key': apiKey,
        'x-reap-entity-id': entityId
      },
      body: JSON.stringify(payload)
    });

    const responseData = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(responseData, null, 2));

    if (response.ok) {
      console.log('✅ SUCCESS: Simulation worked!');
    } else {
      console.log('❌ FAILED: Simulation failed');
    }
  } catch (error) {
    console.error('Error:', error);
  }
};

testSimulation();
