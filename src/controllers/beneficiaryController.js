import Beneficiary from '../models/Beneficiary.js';
import { validateSwiftCountry } from '../utils/countryUtils.js';

const getMyBeneficiaries = async (req, res) => {
  try {
    const userId = req.user?._id;

    const beneficiaries = await Beneficiary.find({ userId })
      .sort({ updatedAt: -1 })
      .select('-__v');

    return res.status(200).json({
      success: true,
      data: beneficiaries
    });
  } catch (error) {
    console.error('Get beneficiaries error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while retrieving beneficiaries'
    });
  }
};

const createOrUpdateBeneficiary = async (req, res) => {
  try {
    const userId = req.user?._id;
    const {
      nickname,
      recipientCompany,
      recipientBank,
      recipientBankSwiftCode,
      accountNumber,
      recipientBankCountry,
      recipientAddress,
      recipientBankAddress
    } = req.body;

    const required = [
      'recipientCompany',
      'recipientBank',
      'recipientBankSwiftCode',
      'accountNumber',
      'recipientBankCountry',
      'recipientAddress',
      'recipientBankAddress'
    ];
    const missing = required.filter((key) => !req.body[key]);
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missing.join(', ')}`
      });
    }
    
    const swiftCode = recipientBankSwiftCode.trim();
    const swiftRegex = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/;
    if (!swiftRegex.test(swiftCode)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid SWIFT code format'
      });
    }

    if (!validateSwiftCountry(swiftCode, recipientBankCountry)) {
      return res.status(400).json({
        success: false,
        message: 'SWIFT code country code must match the recipient bank country'
      });
    }

    const setValues = {
      nickname: nickname?.trim() || '',
      recipientCompany: recipientCompany.trim(),
      recipientBank: recipientBank.trim(),
      recipientBankSwiftCode: recipientBankSwiftCode.trim(),
      accountNumber: accountNumber.trim(),
      recipientBankCountry: recipientBankCountry.trim(),
      recipientAddress: recipientAddress.trim(),
      recipientBankAddress: recipientBankAddress.trim(),
      lastUsedAt: new Date()
    };

    const beneficiary = await Beneficiary.findOneAndUpdate(
      {
        userId,
        recipientBankSwiftCode: recipientBankSwiftCode.trim(),
        accountNumber: accountNumber.trim()
      },
      { $set: setValues, $inc: { useCount: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Beneficiary saved successfully',
      data: beneficiary
    });
  } catch (error) {
    console.error('Save beneficiary error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while saving beneficiary'
    });
  }
};

const deleteBeneficiary = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { beneficiaryId } = req.params;

    const deleted = await Beneficiary.findOneAndDelete({ _id: beneficiaryId, userId });
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Beneficiary not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Beneficiary deleted successfully'
    });
  } catch (error) {
    console.error('Delete beneficiary error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while deleting beneficiary'
    });
  }
};

export { getMyBeneficiaries, createOrUpdateBeneficiary, deleteBeneficiary };
