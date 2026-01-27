import WalletService from '../services/walletService.js';

/**
 * Get or create wallet for user
 * GET /api/wallet/initialize
 */
const initializeWallet = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const wallet = await WalletService.getOrCreateWallet(userId);

    res.status(200).json({
      success: true,
      data: wallet,
      message: 'Wallet initialized'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get wallet balance
 * GET /api/wallet/balance
 */
const getWalletBalance = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const balance = await WalletService.getWalletBalance(userId);

    res.status(200).json({
      success: true,
      data: balance
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get wallet summary
 * GET /api/wallet/summary
 */
const getWalletSummary = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const summary = await WalletService.getWalletSummary(userId);

    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get transaction history
 * GET /api/wallet/transactions?page=1&limit=10
 */
const getTransactionHistory = async (req, res) => {
  try {
    const userId = req.user?.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const history = await WalletService.getTransactionHistory(userId, page, limit);

    res.status(200).json({
      success: true,
      data: history
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get funding history (credit transactions only)
 * GET /api/wallet/funding-history?page=1&limit=10
 */
const getFundingHistory = async (req, res) => {
  try {
    const userId = req.user?.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const fundingHistory = await WalletService.getFundingHistory(userId, page, limit);

    res.status(200).json({
      success: true,
      data: fundingHistory
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Validate if user has sufficient balance
 * POST /api/wallet/validate-balance
 * Body: { amount: number }
 */
const validateBalance = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { amount } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount'
      });
    }

    const isValid = await WalletService.validateBalance(userId, amount);
    const balance = await WalletService.getWalletBalance(userId);

    res.status(200).json({
      success: true,
      data: {
        isValid,
        requiredAmount: amount,
        currentBalance: balance.balance,
        message: isValid 
          ? 'Sufficient balance available' 
          : `Insufficient balance. Need ₦${amount - balance.balance} more`
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Process Fidelity payment completion for wallet funding
 * POST /api/wallet/process-fidelity-payment
 * Body: { fidelityPaymentId: string }
 */
const processFidelityPayment = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { fidelityPaymentId } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    if (!fidelityPaymentId) {
      return res.status(400).json({
        success: false,
        message: 'Fidelity payment ID required'
      });
    }

    const result = await WalletService.processFidelityPaymentCompletion(fidelityPaymentId, userId);

    res.status(200).json({
      success: true,
      data: result,
      message: 'Wallet funded successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Admin: Approve payment and debit wallet for REAP transfer
 * POST /api/wallet/approve-payment/:paymentId
 * Body: { userId: string }
 */
const approvePaymentWithWalletDebit = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { userId } = req.body;
    const approvedBy = req.user?.id;

    if (!approvedBy) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    if (!paymentId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Payment ID and User ID required'
      });
    }

    const result = await WalletService.approvePaymentWithWalletDebit(paymentId, userId, approvedBy);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


const walletController = {
  initializeWallet,
  getWalletBalance,
  getWalletSummary,
  getTransactionHistory,
  getFundingHistory,
  validateBalance,
  processFidelityPayment,
  approvePaymentWithWalletDebit
};

export default walletController;
