import Wallet from '../models/Wallet.js';
import WalletTransaction from '../models/WalletTransaction.js';
import FidelityPayment from '../models/FidelityPayment.js';
import Payment from '../models/Payment.js';
import PlatformSettings from '../models/PlatformSettings.js';

class WalletService {
  /**
   * Get or create wallet for user
   */
  static async getOrCreateWallet(userId) {
    try {
      let wallet = await Wallet.findOne({ userId });

      if (!wallet) {
        wallet = new Wallet({
          userId,
          balance: 0,
          currency: 'USD',
          status: 'active'
        });
        await wallet.save();
      }

      return {
        walletId: wallet._id,
        userId: wallet.userId,
        balance: wallet.balance,
        currency: wallet.currency,
        lastUpdated: wallet.updatedAt
      };
    } catch (error) {
      throw new Error(`Failed to get/create wallet: ${error.message}`);
    }
  }

  /**
   * Get wallet balance for user
   */
  static async getWalletBalance(userId) {
    try {
      const wallet = await Wallet.findOne({ userId });

      if (!wallet) {
        return this.getOrCreateWallet(userId);
      }

      return {
        walletId: wallet._id.toString(),
        userId: wallet.userId,
        balance: wallet.balance,
        currency: wallet.currency,
        lastUpdated: wallet.updatedAt
      };
    } catch (error) {
      throw new Error(`Failed to get wallet balance: ${error.message}`);
    }
  }

  /**
   * Add funds to wallet (after successful Fidelity payment)
   */
  static async creditWallet(userId, amount, description, fidelityPaymentId) {
    try {
      const wallet = await Wallet.findOne({ userId });

      if (!wallet) {
        throw new Error('Wallet not found for user');
      }

      const previousBalance = wallet.balance;
      wallet.balance += amount;
      wallet.updatedAt = new Date();

      await wallet.save();

      // Create transaction record
      const transaction = new WalletTransaction({
        walletId: wallet._id,
        userId,
        type: 'credit',
        amount,
        description,
        reference: fidelityPaymentId,
        previousBalance,
        newBalance: wallet.balance
      });

      await transaction.save();

      return {
        success: true,
        walletId: wallet._id,
        previousBalance,
        newBalance: wallet.balance,
        transactionId: transaction._id,
        message: `Successfully credited ₦${amount} to wallet`
      };
    } catch (error) {
      throw new Error(`Failed to credit wallet: ${error.message}`);
    }
  }

  /**
   * Debit wallet for payment submission
   */
  static async debitWallet(userId, amount, description, paymentId) {
    try {
      const wallet = await Wallet.findOne({ userId });

      if (!wallet) {
        throw new Error('Wallet not found for user');
      }

      // Check balance
      if (wallet.balance < amount) {
        throw new Error(
          `Insufficient wallet balance. Required: ${amount}, Available: ${wallet.balance}`
        );
      }

      const previousBalance = wallet.balance;
      wallet.balance -= amount;
      wallet.updatedAt = new Date();

      await wallet.save();

      // Create transaction record
      const transaction = new WalletTransaction({
        walletId: wallet._id,
        userId,
        type: 'debit',
        amount,
        description,
        reference: paymentId,
        previousBalance,
        newBalance: wallet.balance
      });

      await transaction.save();

      return {
        success: true,
        walletId: wallet._id,
        previousBalance,
        newBalance: wallet.balance,
        transactionId: transaction._id,
        message: `Successfully debited ₦${amount} from wallet`
      };
    } catch (error) {
      throw new Error(`Failed to debit wallet: ${error.message}`);
    }
  }

  /**
   * Validate if user has sufficient balance for payment
   */
  static async validateBalance(userId, amount) {
    try {
      const wallet = await Wallet.findOne({ userId });

      if (!wallet) {
        return false;
      }

      return wallet.balance >= amount;
    } catch (error) {
      throw new Error(`Failed to validate balance: ${error.message}`);
    }
  }

  /**
   * Get wallet transaction history
   */
  static async getTransactionHistory(userId, page = 1, limit = 10) {
    try {
      const wallet = await Wallet.findOne({ userId });

      if (!wallet) {
        throw new Error('Wallet not found');
      }

      const skip = (page - 1) * limit;

      const transactions = await WalletTransaction.find({
        walletId: wallet._id
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await WalletTransaction.countDocuments({
        walletId: wallet._id
      });

      return {
        transactions: transactions.map(t => ({
          transactionId: t._id,
          type: t.type,
          amount: t.amount,
          description: t.description,
          reference: t.reference,
          previousBalance: t.previousBalance,
          newBalance: t.newBalance,
          createdAt: t.createdAt
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw new Error(`Failed to get transaction history: ${error.message}`);
    }
  }

  /**
   * Get funding history (only credit transactions)
   */
  static async getFundingHistory(userId, page = 1, limit = 10) {
    try {
      const wallet = await Wallet.findOne({ userId });

      if (!wallet) {
        throw new Error('Wallet not found');
      }

      const skip = (page - 1) * limit;

      const fundingTransactions = await WalletTransaction.find({
        walletId: wallet._id,
        type: 'credit'
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await WalletTransaction.countDocuments({
        walletId: wallet._id,
        type: 'credit'
      });

      // Enrich with Fidelity payment details
      const enriched = await Promise.all(
        fundingTransactions.map(async t => {
          const fidelityPayment = await FidelityPayment.findById(t.reference);

          return {
            transactionId: t._id,
            fidelityPaymentId: fidelityPayment?._id || t.reference,
            transactionRef: fidelityPayment?.transactionRef,
            amount: t.amount,
            description: t.description,
            previousBalance: t.previousBalance,
            newBalance: t.newBalance,
            status: fidelityPayment?.status || 'Unknown',
            createdAt: t.createdAt
          };
        })
      );

      return {
        fundingTransactions: enriched,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw new Error(`Failed to get funding history: ${error.message}`);
    }
  }

  /**
   * Process Fidelity payment completion for wallet funding
   */
  static async processFidelityPaymentCompletion(fidelityPaymentId, userId) {
    try {
      const fidelityPayment = await FidelityPayment.findById(fidelityPaymentId);

      if (!fidelityPayment) {
        throw new Error('Fidelity payment not found');
      }

      if (fidelityPayment.status !== 'COMPLETED' && fidelityPayment.status !== 'Successful') {
        throw new Error('Payment not successful');
      }

      // Check if already processed
      const existingTransaction = await WalletTransaction.findOne({
        reference: fidelityPaymentId,
        type: 'credit'
      });

      if (existingTransaction) {
        throw new Error('Payment already processed for wallet');
      }

      // Credit wallet
      const result = await this.creditWallet(
        userId,
        fidelityPayment.amount,
        `Account funding - Fidelity Payment ${fidelityPaymentId}`,
        fidelityPaymentId
      );

      return result;
    } catch (error) {
      throw new Error(`Failed to process Fidelity payment: ${error.message}`);
    }
  }

  /**
   * Admin: Approve payment submission and debit wallet for REAP transfer
   */
  static async approvePaymentWithWalletDebit(paymentId, approvedBy) {
    try {
      const payment = await Payment.findById(paymentId);

      if (!payment) {
        throw new Error('Payment not found');
      }

      if (payment.status !== 'approved') {
        throw new Error('Payment must be approved before wallet debit');
      }

      if (payment.reapStatus !== 'sent') {
        const reapReason = payment.reapErrorMessage
          ? `Reap error: ${payment.reapErrorMessage}`
          : `Current Reap status: ${payment.reapStatus}`;
        throw new Error(
          `Cannot debit wallet before Reap accepts the payment request. ${reapReason}`
        );
      }

      const userId = payment.userId;

      const amount = payment.localAmount;

      // Validate wallet balance
      const hasBalance = await this.validateBalance(userId, amount);

      if (!hasBalance) {
        throw new Error('Insufficient wallet balance for approval');
      }

      // Debit wallet
      const debitResult = await this.debitWallet(
        userId,
        amount,
        `Payment approval - Invoice ${payment._id}`,
        paymentId
      );

      // Update payment status after successful debit
      payment.status = 'processing';
      payment.approvedBy = payment.approvedBy || approvedBy;
      payment.approvedAt = payment.approvedAt || new Date();
      payment.processedAt = new Date();

      await payment.save();

      return {
        success: true,
        paymentId: payment._id,
        walletDebitAmount: amount,
        newWalletBalance: debitResult.newBalance,
        status: payment.status,
        reapStatus: payment.reapStatus,
        message: 'Wallet debited successfully. Payment moved to processing.'
      };
    } catch (error) {
      throw new Error(`Failed to approve payment with wallet debit: ${error.message}`);
    }
  }

  /**
   * Convert NGN to USDT using platform exchange rate
   */
  static async convertNgnToUsdt(ngnAmount) {
    try {
      const settings = await PlatformSettings.findOne();
      
      if (!settings || !settings.usdNgnRate) {
        throw new Error('Exchange rate not configured');
      }

      const usdAmount = ngnAmount / settings.usdNgnRate;
      
      return {
        usdtAmount: parseFloat(usdAmount.toFixed(2)),
        exchangeRate: settings.usdNgnRate
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get wallet summary (balance + recent transactions)
   */
  static async getWalletSummary(userId) {
    try {
      let wallet = await Wallet.findOne({ userId });

      if (!wallet) {
        wallet = new Wallet({
          userId,
          balance: 0,
          currency: 'NGN',
          status: 'active'
        });
        await wallet.save();
      }

      const balance = await this.getWalletBalance(userId);
      const recentTransactions = await WalletTransaction.find({
        walletId: wallet._id
      })
        .sort({ createdAt: -1 })
        .limit(5);

      const totalFunded = await WalletTransaction.aggregate([
        { $match: { walletId: wallet._id, type: 'credit' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);

      const totalUsed = await WalletTransaction.aggregate([
        { $match: { walletId: wallet._id, type: 'debit' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);

      return {
        balance: balance.balance,
        currency: balance.currency,
        totalFunded: totalFunded[0]?.total || 0,
        totalUsed: totalUsed[0]?.total || 0,
        transactionCount: recentTransactions.length,
        recentTransactions: recentTransactions.map(t => ({
          type: t.type,
          amount: t.amount,
          description: t.description,
          createdAt: t.createdAt
        }))
      };
    } catch (error) {
      throw new Error(`Failed to get wallet summary: ${error.message}`);
    }
  }
}

export { WalletService };
export default WalletService;
