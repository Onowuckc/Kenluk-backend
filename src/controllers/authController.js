import crypto from 'crypto';
import User from '../models/User.js';
import { generateAuthTokens } from '../utils/generateToken.js';
import { sendEmail } from '../config/mailer.js';
import { generateVerificationEmail, generatePasswordResetEmail, generateWelcomeEmail } from '../utils/emailTemplates.js';
import { isCompanyPaymentAccount } from '../utils/companyPaymentAccount.js';
import speakeasy from 'speakeasy';
import { decryptTwoFactorSecret } from '../utils/twoFactor.js';

/**
 * Register a new user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Generate verification token and OTP code
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Create user with OTP code and expiration
    const user = await User.create({
      name,
      email,
      password,
      verificationToken,
      verificationCode,
      verificationCodeExpire: Date.now() + 10 * 60 * 1000 // 10 minutes
    });

    // Send verification email with OTP code
    try {
      await sendEmail(
        email,
        'Verify Your Kenluk Account',
        generateVerificationEmail(name, verificationCode)
      );
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Continue with registration even if email fails
    }

    res.status(201).json({
      success: true,
      message: 'User registered successfully. Please check your email to verify your account.',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          isVerified: user.isVerified
        }
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
};

/**
 * Login user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user and include password for comparison
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if account is verified
    if (!user.isVerified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email before logging in'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // If user has authenticator app 2FA enabled, require a TOTP code before issuing tokens.
    if (user.twoFactorEnabled) {
      return res.status(200).json({
        success: true,
        message: 'Enter the 6-digit code from your authenticator app',
        data: {
          twoFactorRequired: true,
          email: user.email
        }
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate tokens
    const tokens = generateAuthTokens(user._id, user.email);

    // Set cookies
    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    const companyPaymentAccount = isCompanyPaymentAccount(user);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          isVerified: user.isVerified,
          role: user.isAdmin ? 'admin' : 'user',
          accountType: companyPaymentAccount ? 'company' : user.accountType || 'customer',
          accountStatus: companyPaymentAccount ? 'approved' : user.accountStatus,
          documentsSubmitted: user.documentsSubmitted,
          twoFactorEnabled: user.twoFactorEnabled
        },
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken
        }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
};

/**
 * Verify email
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const verifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email already verified'
      });
    }

    // Check OTP code and expiration
    if (!otp || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification code format'
      });
    }

    // Check if OTP matches and hasn't expired
    if (user.verificationCode !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification code'
      });
    }

    if (user.verificationCodeExpire < Date.now()) {
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired. Please request a new one.'
      });
    }

    // Verify user
    user.isVerified = true;
    user.verificationToken = undefined;
    await user.save();

    // Send welcome email (will fail if email credentials not set)
    try {
      await sendEmail(
        user.email,
        'Welcome to Kenluk!',
        generateWelcomeEmail(user.name)
      );
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      // Don't fail the verification if welcome email fails
    }

    res.status(200).json({
      success: true,
      message: 'Email verified successfully'
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during email verification'
    });
  }
};

/**
 * Verify 2FA code and complete login
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const verifyTwoFactor = async (req, res) => {
  try {
    const { email, twoFactorCode } = req.body;

    const user = await User.findOne({ email }).select('+password +twoFactorSecret');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.twoFactorEnabled) {
      return res.status(400).json({
        success: false,
        message: 'Two-factor authentication is not enabled for this account'
      });
    }

    if (!user.twoFactorSecret) {
      return res.status(400).json({
        success: false,
        message: 'Two-factor authentication setup is incomplete'
      });
    }

    const secret = decryptTwoFactorSecret(user.twoFactorSecret);
    const isValidCode = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: twoFactorCode,
      window: 1
    });

    if (!isValidCode) {
      return res.status(400).json({
        success: false,
        message: 'Invalid 2FA code'
      });
    }

    user.twoFactorCode = undefined;
    user.twoFactorCodeExpire = undefined;
    user.lastLogin = new Date();
    await user.save();

    const tokens = generateAuthTokens(user._id, user.email);

    // Set cookies
    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    const companyPaymentAccount = isCompanyPaymentAccount(user);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          isVerified: user.isVerified,
          role: user.isAdmin ? 'admin' : 'user',
          accountType: companyPaymentAccount ? 'company' : user.accountType || 'customer',
          accountStatus: companyPaymentAccount ? 'approved' : user.accountStatus,
          documentsSubmitted: user.documentsSubmitted,
          twoFactorEnabled: user.twoFactorEnabled
        },
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken
        }
      }
    });
  } catch (error) {
    console.error('2FA verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during 2FA verification'
    });
  }
};

/**
 * Resend 2FA code for pending two-factor authentication
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const resendTwoFactorCode = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.twoFactorEnabled) {
      return res.status(400).json({
        success: false,
        message: 'Two-factor authentication is not enabled for this account'
      });
    }

    res.status(400).json({
      success: false,
      message: 'Open your authenticator app to get a current 2FA code'
    });
  } catch (error) {
    console.error('Resend 2FA code error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during 2FA resend'
    });
  }
};

/**
 * Resend verification code
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const resendVerificationCode = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email already verified'
      });
    }

    // Generate new verification OTP code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Update user with new OTP code and expiration
    user.verificationCode = verificationCode;
    user.verificationCodeExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save();

    // Send verification email with new OTP code
    try {
      await sendEmail(
        email,
        'Verify Your Kenluk Account',
        generateVerificationEmail(user.name, verificationCode)
      );
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      return res.status(500).json({
        success: false,
        message: 'Failed to send verification email'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Verification code sent successfully'
    });
  } catch (error) {
    console.error('Resend verification code error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during resend verification code'
    });
  }
};

/**
 * Request password reset
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      // Don't reveal if user exists or not for security
      return res.status(200).json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetPasswordExpire = Date.now() + 60 * 60 * 1000; // 1 hour

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpire = resetPasswordExpire;
    await user.save();

    // Generate reset URL
    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;

    // Send reset email
    try {
      await sendEmail(
        email,
        'Reset Your Kenluk Password',
        generatePasswordResetEmail(user.name, resetUrl)
      );
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
      return res.status(500).json({
        success: false,
        message: 'Failed to send password reset email'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Password reset link sent to your email'
    });
  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during password reset request'
    });
  }
};

/**
 * Reset password
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    // Update password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during password reset'
    });
  }
};

/**
 * Logout user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const logout = (req, res) => {
  // Clear cookies
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');

  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
};

/**
 * Admin login
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const adminLogin = async (req, res) => {
  const fs = await import('fs');
  const path = await import('path');

  const logFile = path.join(process.cwd(), 'logs', 'admin-login.log');
  const logMessage = (message) => {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    console.log(message);
    try {
      fs.appendFileSync(logFile, logEntry);
    } catch (error) {
      console.error(`Failed to write to log file: ${error.message}`);
    }
  };

  try {
    const { email, password } = req.body;

    logMessage(`🔐 Admin login attempt - Email: ${email}`);

    // Find user and include password for comparison
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      logMessage(`❌ Admin login failed - User not found: ${email}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    logMessage(`✅ User found: ${user.email}, isAdmin: ${user.isAdmin}, isVerified: ${user.isVerified}`);

    // Check if user is admin
    if (!user.isAdmin) {
      logMessage(`❌ Admin login failed - User is not admin: ${email}`);
      return res.status(401).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      logMessage(`❌ Admin login failed - Invalid password for: ${email}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    logMessage(`✅ Password verified for admin: ${email}`);

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate tokens
    const tokens = generateAuthTokens(user._id, user.email);

    // Set cookies
    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    logMessage(`🎉 Admin login successful for: ${email}`);

    const companyPaymentAccount = isCompanyPaymentAccount(user);

    res.status(200).json({
      success: true,
      message: 'Admin login successful',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          isVerified: user.isVerified,
          role: 'admin',
          accountType: companyPaymentAccount ? 'company' : user.accountType || 'customer',
          accountStatus: companyPaymentAccount ? 'approved' : user.accountStatus,
          documentsSubmitted: user.documentsSubmitted,
          twoFactorEnabled: user.twoFactorEnabled
        },
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken
        }
      }
    });
  } catch (error) {
    logMessage(`💥 Admin login error: ${error.message}`);
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during admin login'
    });
  }
};

/**
 * Verify authentication token and return user data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const verify = async (req, res) => {
  try {
    // Get token from header or cookie
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    // Verify token
    const { verifyToken } = await import('../utils/generateToken.js');
    const decoded = verifyToken(token, 'access');

    // Find user
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token - user not found'
      });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        success: false,
        message: 'Account not verified'
      });
    }

    const companyPaymentAccount = isCompanyPaymentAccount(user);

    res.status(200).json({
      success: true,
      message: 'Token verified successfully',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.isAdmin ? 'admin' : 'user',
          accountType: companyPaymentAccount ? 'company' : user.accountType || 'customer',
          isVerified: user.isVerified,
          accountStatus: companyPaymentAccount ? 'approved' : user.accountStatus,
          documentsSubmitted: user.documentsSubmitted,
          twoFactorEnabled: user.twoFactorEnabled
        }
      }
    });
  } catch (error) {
    console.error('Token verification error:', error);

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error during token verification'
    });
  }
};

/**
 * Refresh access token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token required'
      });
    }

    // Verify refresh token
    const { verifyToken } = await import('../utils/generateToken.js');
    const decoded = verifyToken(refreshToken, 'refresh');

    // Find user
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    // Generate new access token
    const { generateToken } = await import('../utils/generateToken.js');
    const accessToken = generateToken(user._id, user.email, 'access');

    // Set new access token cookie
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken
      }
    });
  } catch (error) {
    console.error('Token refresh error:', error);

    if (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error during token refresh'
    });
  }
};

// In-memory cache for USDC-NGN rate
let rateCache = {
  rate: null,
  timestamp: null,
  ttl: 30 * 1000 // 30 seconds
};

/**
 * Fetch USDC to NGN rate with caching and retry logic
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getUsdcNgnRate = async (req, res) => {
  try {
    // Check cache first
    const now = Date.now();
    if (rateCache.rate && rateCache.timestamp && (now - rateCache.timestamp) < rateCache.ttl) {
      console.log('📊 Returning cached USDC-NGN rate');
      return res.status(200).json({
        success: true,
        rate: rateCache.rate,
        source: rateCache.source,
        lastUpdated: new Date(rateCache.timestamp).toISOString()
      });
    }

    let rate = null;
    let source = null;

    // Try CoinGecko first
    try {
      console.log('🌐 Fetching from CoinGecko API');
      const coingeckoResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=ngn');
      if (coingeckoResponse.ok) {
        const data = await coingeckoResponse.json();
        rate = data['usd-coin']?.ngn;
        source = 'CoinGecko';
      }
    } catch (error) {
      console.warn('⚠️ CoinGecko API failed:', error.message);
    }

    // Fallback to Exchangerate.host if CoinGecko failed
    if (!rate) {
      try {
        console.log('🌐 Fetching from Exchangerate.host API');
        const exchangerateResponse = await fetch('https://api.exchangerate.host/convert?from=USDC&to=NGN');
        if (exchangerateResponse.ok) {
          const data = await exchangerateResponse.json();
          rate = data.result;
          source = 'Exchangerate.host';
        }
      } catch (error) {
        console.warn('⚠️ Exchangerate.host API failed:', error.message);
      }
    }

    if (!rate) {
      return res.status(500).json({
        success: false,
        message: 'Unable to fetch exchange rate from any source'
      });
    }

    // Apply +25 markup
    const finalRate = rate + 25;

    // Update cache
    rateCache = {
      rate: finalRate,
      source,
      timestamp: now
    };

    console.log(`💰 USDC-NGN rate fetched: ${finalRate} from ${source}`);

    res.status(200).json({
      success: true,
      rate: finalRate,
      source,
      lastUpdated: new Date(now).toISOString()
    });
  } catch (error) {
    console.error('❌ Error fetching USDC-NGN rate:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching exchange rate'
    });
  }
};

export {
  register,
  login,
  adminLogin,
  verifyEmail,
  verifyTwoFactor,
  resendTwoFactorCode,
  resendVerificationCode,
  requestPasswordReset,
  resetPassword,
  logout,
  verify,
  refreshToken,
  getUsdcNgnRate
};
