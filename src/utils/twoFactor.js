import crypto from 'crypto';

const getEncryptionKey = () => {
  const secret =
    process.env.TWO_FACTOR_SECRET_KEY ||
    process.env.JWT_ACCESS_SECRET ||
    process.env.JWT_REFRESH_SECRET;

  if (!secret) {
    throw new Error('TWO_FACTOR_SECRET_KEY or JWT secret is required for 2FA secret encryption');
  }

  return crypto.createHash('sha256').update(secret).digest();
};

const encryptTwoFactorSecret = (secret) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(secret, 'utf8'),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64')
  ].join(':');
};

const decryptTwoFactorSecret = (encryptedSecret) => {
  const [iv, authTag, encrypted] = encryptedSecret.split(':');

  if (!iv || !authTag || !encrypted) {
    throw new Error('Invalid encrypted 2FA secret format');
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(authTag, 'base64'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64')),
    decipher.final()
  ]);

  return decrypted.toString('utf8');
};

export {
  encryptTwoFactorSecret,
  decryptTwoFactorSecret
};
