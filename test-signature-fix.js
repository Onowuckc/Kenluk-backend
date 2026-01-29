import * as fidelityEncryption from './src/utils/fidelityEncryption.js';

const testRequestRef = 'REQ-1234567890-ABCDEF';
const testClientSecret = 'test-secret-key';

console.log('Testing signature generation fix...');
console.log('Request Ref:', testRequestRef);
console.log('Client Secret:', testClientSecret);

const signature = fidelityEncryption.generatePaygateSignature(testRequestRef, testClientSecret);
console.log('Generated Signature:', signature);

// Expected format: MD5Hash(request_ref;client_secret)
const expectedData = `${testRequestRef};${testClientSecret}`;
console.log('Expected data for hashing:', expectedData);

// Verify the signature matches what we expect
const crypto = await import('crypto');
const expectedSignature = crypto.default.createHash('md5').update(expectedData).digest('hex');
console.log('Expected Signature:', expectedSignature);

if (signature === expectedSignature) {
    console.log('✅ Signature generation is correct!');
} else {
    console.log('❌ Signature generation is incorrect!');
}
