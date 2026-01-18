import PlatformSettings from '../models/PlatformSettings.js';

/**
 * Get current exchange rates
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getExchangeRates = async (req, res) => {
  try {
    let settings = await PlatformSettings.findOne().populate('lastUpdatedBy', 'name email');

    // If no settings exist, create default ones
    if (!settings) {
      const adminId = req.user?._id;
      if (!adminId && req.query.defaultOnly !== 'true') {
        return res.status(404).json({
          success: false,
          message: 'Platform settings not configured'
        });
      }

      settings = new PlatformSettings({
        usdToNgnRate: 1500,
        ngnToUsdRate: 0.0006667,
        lastUpdatedBy: adminId,
        updatedAt: new Date()
      });
      await settings.save();
    }

    res.status(200).json({
      success: true,
      message: 'Exchange rates retrieved successfully',
      data: {
        usdToNgnRate: settings.usdToNgnRate,
        ngnToUsdRate: settings.ngnToUsdRate,
        lastUpdatedBy: settings.lastUpdatedBy,
        updatedAt: settings.updatedAt,
        notes: settings.notes
      }
    });

  } catch (error) {
    console.error('Get exchange rates error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching exchange rates'
    });
  }
};

/**
 * Update exchange rates (admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateExchangeRates = async (req, res) => {
  try {
    const { usdToNgnRate, ngnToUsdRate, notes } = req.body;
    const adminId = req.user._id;

    // Validate input
    if (!usdToNgnRate || !ngnToUsdRate) {
      return res.status(400).json({
        success: false,
        message: 'Both usdToNgnRate and ngnToUsdRate are required'
      });
    }

    if (typeof usdToNgnRate !== 'number' || usdToNgnRate <= 0) {
      return res.status(400).json({
        success: false,
        message: 'usdToNgnRate must be a positive number'
      });
    }

    if (typeof ngnToUsdRate !== 'number' || ngnToUsdRate <= 0) {
      return res.status(400).json({
        success: false,
        message: 'ngnToUsdRate must be a positive number'
      });
    }

    // Verify rates are reciprocals (within 0.1% tolerance)
    const expectedReciprocal = 1 / usdToNgnRate;
    const difference = Math.abs(expectedReciprocal - ngnToUsdRate) / expectedReciprocal;
    if (difference > 0.001) {
      return res.status(400).json({
        success: false,
        message: 'Rates must be reciprocals. ngnToUsdRate should be approximately 1 / usdToNgnRate'
      });
    }

    // Find or create settings
    let settings = await PlatformSettings.findOne();
    if (!settings) {
      settings = new PlatformSettings({
        usdToNgnRate,
        ngnToUsdRate,
        lastUpdatedBy: adminId,
        notes: notes || ''
      });
    } else {
      settings.usdToNgnRate = usdToNgnRate;
      settings.ngnToUsdRate = ngnToUsdRate;
      settings.lastUpdatedBy = adminId;
      settings.updatedAt = new Date();
      if (notes) {
        settings.notes = notes;
      }
    }

    await settings.save();
    await settings.populate('lastUpdatedBy', 'name email');

    console.log(`✅ Exchange rates updated: USD→NGN=${usdToNgnRate}, NGN→USD=${ngnToUsdRate} by admin ${adminId}`);

    res.status(200).json({
      success: true,
      message: 'Exchange rates updated successfully',
      data: {
        usdToNgnRate: settings.usdToNgnRate,
        ngnToUsdRate: settings.ngnToUsdRate,
        lastUpdatedBy: settings.lastUpdatedBy,
        updatedAt: settings.updatedAt,
        notes: settings.notes
      }
    });

  } catch (error) {
    console.error('Update exchange rates error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating exchange rates'
    });
  }
};

export {
  getExchangeRates,
  updateExchangeRates
};
