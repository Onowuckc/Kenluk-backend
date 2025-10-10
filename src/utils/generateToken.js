import jwt from 'jsonwebtoken';

/**
 * Generate JWT token
 * @param {string} userId - User ID to include in the token
 * @param {string} email - User email to include in the token
 * @param {string} [type='access'] - Token type: 'access' or 'refresh'
 * @returns {string} JWT token
 */
const generateToken = (userId, email, type = 'access') => {
  const secret = type === 'access' 
    ? process.env.JWT_ACCESS_SECRET 
    : process.env.JWT_REFRESH_SECRET;
  
  const expiresIn = type === 'access' 
    ? process.env.JWT_ACCESS_EXPIRE || '15m'
    : process.env.JWT_REFRESH_EXPIRE || '7d';

  if (!secret) {
    throw new Error(`JWT ${type} secret is not defined`);
  }

  const payload = {
    userId,
    email,
    type
  };

  return jwt.sign(payload, secret, { expiresIn });
};

/**
 * Generate both access and refresh tokens
 * @param {string} userId - User ID
 * @param {string} email - User email
 * @returns {Object} Object containing accessToken and refreshToken
 */
const generateAuthTokens = (userId, email) => {
  const accessToken = generateToken(userId, email, 'access');
  const refreshToken = generateToken(userId, email, 'refresh');

  return {
    accessToken,
    refreshToken
  };
};

/**
 * Verify JWT token
 * @param {string} token - JWT token to verify
 * @param {string} type - Token type: 'access' or 'refresh'
 * @returns {Object} Decoded token payload
 */
const verifyToken = (token, type = 'access') => {
  const secret = type === 'access' 
    ? process.env.JWT_ACCESS_SECRET 
    : process.env.JWT_REFRESH_SECRET;

  if (!secret) {
    throw new Error(`JWT ${type} secret is not defined`);
  }

  return jwt.verify(token, secret);
};

export {
  generateToken,
  generateAuthTokens,
  verifyToken
};
