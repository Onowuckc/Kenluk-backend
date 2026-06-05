import User from '../models/User.js';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import { decryptTwoFactorSecret, encryptTwoFactorSecret } from '../utils/twoFactor.js';

const getAuthenticatedUserId = (req) => req.user?.userId || req.user?._id || req.user?.id;

/**
 * Get user profile
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(getAuthenticatedUserId(req)).select('-password -resetPasswordToken -resetPasswordExpire -verificationToken -verificationCode -verificationCodeExpire');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          isVerified: user.isVerified,
          approved: user.approved,
          documentsSubmitted: user.documentsSubmitted,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt,
          twoFactorEnabled: user.twoFactorEnabled
        }
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching profile'
    });
  }
};

/**
 * Update user profile
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body;
    const userId = getAuthenticatedUserId(req);

    // Check if email is being changed and if it's already taken
    if (email) {
      const existingUser = await User.findOne({ email, _id: { $ne: userId } });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email already in use'
        });
      }
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password -resetPasswordToken -resetPasswordExpire -verificationToken -verificationCode -verificationCodeExpire');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          isVerified: user.isVerified,
          approved: user.approved,
          documentsSubmitted: user.documentsSubmitted,
          twoFactorEnabled: user.twoFactorEnabled
        }
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating profile'
    });
  }
};

/**
 * Change user password
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = getAuthenticatedUserId(req);

    const user = await User.findById(userId).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while changing password'
    });
  }
};

/**
 * Delete user account
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const deleteAccount = async (req, res) => {
  try {
    const { password } = req.body;
    const userId = getAuthenticatedUserId(req);

    const user = await User.findById(userId).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify password before deletion
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Password is incorrect'
      });
    }

    // Delete user account
    await User.findByIdAndDelete(userId);

    // Clear cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    res.status(200).json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting account'
    });
  }
};

/**
 * Start authenticator app setup
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const startTwoFactorSetup = async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);

    const user = await User.findById(userId).select('+pendingTwoFactorSecret +twoFactorSecret');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.twoFactorEnabled) {
      return res.status(400).json({
        success: false,
        message: 'Two-factor authentication is already enabled'
      });
    }

    const secret = speakeasy.generateSecret({
      name: `Kenluk Pay (${user.email})`,
      issuer: 'Kenluk Pay',
      length: 20
    });

    user.pendingTwoFactorSecret = encryptTwoFactorSecret(secret.base32);
    await user.save();

    const qrCodeDataUrl = await qrcode.toDataURL(secret.otpauth_url);

    res.status(200).json({
      success: true,
      message: 'Scan the QR code with your authenticator app, then enter the 6-digit code to finish setup.',
      data: {
        qrCodeDataUrl,
        manualEntryKey: secret.base32,
        otpauthUrl: secret.otpauth_url
      }
    });
  } catch (error) {
    console.error('Start two-factor setup error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while starting two-factor setup'
    });
  }
};

/**
 * Confirm authenticator app setup
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const confirmTwoFactorSetup = async (req, res) => {
  try {
    const { twoFactorCode } = req.body;
    const userId = getAuthenticatedUserId(req);

    const user = await User.findById(userId).select('+pendingTwoFactorSecret +twoFactorSecret');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.pendingTwoFactorSecret) {
      return res.status(400).json({
        success: false,
        message: 'Two-factor setup has not been started'
      });
    }

    const pendingSecret = decryptTwoFactorSecret(user.pendingTwoFactorSecret);
    const isValidCode = speakeasy.totp.verify({
      secret: pendingSecret,
      encoding: 'base32',
      token: twoFactorCode,
      window: 1
    });

    if (!isValidCode) {
      return res.status(400).json({
        success: false,
        message: 'Invalid authenticator code'
      });
    }

    user.twoFactorSecret = user.pendingTwoFactorSecret;
    user.pendingTwoFactorSecret = undefined;
    user.twoFactorEnabled = true;
    user.twoFactorEnabledAt = new Date();
    user.twoFactorCode = undefined;
    user.twoFactorCodeExpire = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Authenticator app two-factor authentication enabled successfully',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          isVerified: user.isVerified,
          approved: user.approved,
          documentsSubmitted: user.documentsSubmitted,
          twoFactorEnabled: user.twoFactorEnabled
        }
      }
    });
  } catch (error) {
    console.error('Confirm two-factor setup error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while confirming two-factor setup'
    });
  }
};

/**
 * Disable authenticator app two-factor authentication
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const disableTwoFactor = async (req, res) => {
  try {
    const { twoFactorCode } = req.body;
    const userId = getAuthenticatedUserId(req);

    const user = await User.findById(userId).select('+twoFactorSecret +pendingTwoFactorSecret');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(400).json({
        success: false,
        message: 'Two-factor authentication is not enabled'
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
        message: 'Invalid authenticator code'
      });
    }

    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    user.pendingTwoFactorSecret = undefined;
    user.twoFactorEnabledAt = undefined;
    user.twoFactorCode = undefined;
    user.twoFactorCodeExpire = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Two-factor authentication disabled successfully',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          isVerified: user.isVerified,
          approved: user.approved,
          documentsSubmitted: user.documentsSubmitted,
          twoFactorEnabled: user.twoFactorEnabled
        }
      }
    });
  } catch (error) {
    console.error('Disable two-factor error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while disabling two-factor authentication'
    });
  }
};

/**
 * Legacy two-factor authentication toggle
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateTwoFactorSetting = async (req, res) => {
  const { enabled } = req.body;

  if (enabled) {
    return res.status(400).json({
      success: false,
      message: 'Use authenticator app setup to enable two-factor authentication'
    });
  }

  return res.status(400).json({
    success: false,
    message: 'Use the disable two-factor endpoint with an authenticator code'
  });
};

export {
  getProfile,
  updateProfile,
  changePassword,
  deleteAccount,
  startTwoFactorSetup,
  confirmTwoFactorSetup,
  disableTwoFactor,
  updateTwoFactorSetting
};
