import fetch from 'node-fetch';
import Payment from '../models/Payment.js';

/**
 * Simulate funding an account with crypto (Sandbox only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const simulateFundAccount = async (req, res) => {
  try {
    const { currency, amount, network } = req.body;

    // Validate required fields
    if (!currency || !amount || !network) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: currency, amount, network'
      });
    }

    // Validate currency (USDC or USDT)
    if (!['USDC', 'USDT'].includes(currency)) {
      return res.status(400).json({
        success: false,
        message: 'Currency must be USDC or USDT'
      });
    }

    // Validate network
    const validNetworks = ['Ethereum', 'Tron', 'Polygon PoS', 'Solana'];
    if (!validNetworks.includes(network)) {
      return res.status(400).json({
        success: false,
        message: `Network must be one of: ${validNetworks.join(', ')}`
      });
    }

    // Validate amount
    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be positive'
      });
    }

    const reapUrl = process.env.REAP_PAYMENT_API_URL || 'https://sandbox.payments.reap.global/api/simulate/balances';
    const apiKey = process.env.REAP_PAYMENT_API_KEY;
    const entityId = process.env.REAP_ENTITY_ID;

    if (!apiKey || !entityId) {
      return res.status(500).json({
        success: false,
        message: 'Reap Payment API configuration missing'
      });
    }

    const payload = {
      currency,
      amount: amount,
      network,
      type: 'fund_in'
    };

    console.log('Simulating account funding:', JSON.stringify(payload, null, 2));

    const response = await fetch(reapUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;schema=PAAS',
        'x-reap-api-key': apiKey,
        'x-reap-entity-id': entityId,
        'Accept': 'application/vnd.api+json; version=1.0.0'
      },
      body: JSON.stringify(payload)
    });

    let responseData;
    try {
      responseData = await response.json();
    } catch (parseError) {
      console.error('Failed to parse Reap API response:', parseError);
      responseData = { message: 'Invalid response from Reap API' };
    }

    console.log('Reap simulation response:', response.status, responseData);

    if (response.ok) {
      res.status(200).json({
        success: true,
        message: 'Account funded successfully in sandbox',
        data: {
          currency,
          amount,
          network,
          transactionId: responseData?.transactionId || responseData?.id || 'simulated',
          balance: responseData?.balance || amount
        }
      });
    } else {
      res.status(response.status).json({
        success: false,
        message: responseData?.message || 'Failed to fund account',
        error: responseData
      });
    }

  } catch (error) {
    console.error('Simulate fund account error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while simulating account funding'
    });
  }
};

/**
 * Simulate payment lifecycle status change (Sandbox only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const simulatePaymentLifecycle = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { status } = req.body;

    // Validate required fields
    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: status'
      });
    }

    // Validate status
    const validStatuses = ['requires_action', 'failed', 'cancelled', 'payout_completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${validStatuses.join(', ')}`
      });
    }

    // Find payment in our database
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Check if payment has a Reap payment ID
    if (!payment.reapPaymentId) {
      return res.status(400).json({
        success: false,
        message: 'Payment has not been sent to Reap API yet'
      });
    }

    const reapUrl = `${process.env.REAP_PAYMENT_API_URL || 'https://sandbox.payments.reap.global/api'}/simulate/payments/${payment.reapPaymentId}`;
    const apiKey = process.env.REAP_PAYMENT_API_KEY;
    const entityId = process.env.REAP_ENTITY_ID;

    if (!apiKey || !entityId) {
      return res.status(500).json({
        success: false,
        message: 'Reap Payment API configuration missing'
      });
    }

    const payload = { status };

    console.log('Simulating payment lifecycle:', JSON.stringify(payload, null, 2));

    const response = await fetch(reapUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;schema=PAAS',
        'x-reap-api-key': apiKey,
        'x-reap-entity-id': entityId,
        'Accept': 'application/vnd.api+json; version=1.0.0'
      },
      body: JSON.stringify(payload)
    });

    let responseData;
    try {
      responseData = await response.json();
    } catch (parseError) {
      console.error('Failed to parse Reap API response:', parseError);
      responseData = { message: 'Invalid response from Reap API' };
    }

    console.log('Reap simulation response:', response.status, responseData);

    if (response.ok) {
      // Update payment status in our database
      payment.reapStatus = status;
      payment.reapRawResponse = responseData;
      await payment.save();

      res.status(200).json({
        success: true,
        message: `Payment status simulated to ${status}`,
        data: {
          paymentId: payment._id,
          reapPaymentId: payment.reapPaymentId,
          status,
          simulationResponse: responseData
        }
      });
    } else {
      res.status(response.status).json({
        success: false,
        message: responseData.message || 'Failed to simulate payment lifecycle',
        error: responseData
      });
    }

  } catch (error) {
    console.error('Simulate payment lifecycle error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while simulating payment lifecycle'
    });
  }
};

/**
 * Simulate tracking lifecycle status change (Sandbox only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const simulateTrackingLifecycle = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { trackingStatus } = req.body;

    // Validate required fields
    if (!trackingStatus) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: trackingStatus'
      });
    }

    // Validate tracking status
    const validStatuses = ['en_route_trackable', 'en_route_not_trackable', 'arrived_at_recipient'];
    if (!validStatuses.includes(trackingStatus)) {
      return res.status(400).json({
        success: false,
        message: `Tracking status must be one of: ${validStatuses.join(', ')}`
      });
    }

    // Find payment in our database
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Check if payment has a Reap payment ID
    if (!payment.reapPaymentId) {
      return res.status(400).json({
        success: false,
        message: 'Payment has not been sent to Reap API yet'
      });
    }

    const reapUrl = `${process.env.REAP_PAYMENT_API_URL || 'https://sandbox.payments.reap.global/api'}/simulate/tracking/${payment.reapPaymentId}`;
    const apiKey = process.env.REAP_PAYMENT_API_KEY;
    const entityId = process.env.REAP_ENTITY_ID;

    if (!apiKey || !entityId) {
      return res.status(500).json({
        success: false,
        message: 'Reap Payment API configuration missing'
      });
    }

    const payload = { trackingStatus };

    console.log('Simulating tracking lifecycle:', JSON.stringify(payload, null, 2));

    const response = await fetch(reapUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;schema=PAAS',
        'x-reap-api-key': apiKey,
        'x-reap-entity-id': entityId,
        'Accept': 'application/vnd.api+json; version=1.0.0'
      },
      body: JSON.stringify(payload)
    });

    let responseData;
    try {
      responseData = await response.json();
    } catch (parseError) {
      console.error('Failed to parse Reap API response:', parseError);
      responseData = { message: 'Invalid response from Reap API' };
    }

    console.log('Reap simulation response:', response.status, responseData);

    if (response.ok) {
      // Update payment tracking status in our database
      payment.reapTrackingStatus = trackingStatus;
      payment.reapRawResponse = responseData;
      await payment.save();

      res.status(200).json({
        success: true,
        message: `Payment tracking status simulated to ${trackingStatus}`,
        data: {
          paymentId: payment._id,
          reapPaymentId: payment.reapPaymentId,
          trackingStatus,
          simulationResponse: responseData
        }
      });
    } else {
      res.status(response.status).json({
        success: false,
        message: responseData.message || 'Failed to simulate tracking lifecycle',
        error: responseData
      });
    }

  } catch (error) {
    console.error('Simulate tracking lifecycle error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while simulating tracking lifecycle'
    });
  }
};

/**
 * Get account balance from Reap API
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getAccountBalance = async (req, res) => {
  try {
    const reapUrl = `${process.env.REAP_PAYMENT_API_URL || 'https://sandbox.payments.reap.global/api'}/account-info`;
    const apiKey = process.env.REAP_PAYMENT_API_KEY;
    const entityId = process.env.REAP_ENTITY_ID;

    if (!apiKey || !entityId) {
      return res.status(500).json({
        success: false,
        message: 'Reap Payment API configuration missing'
      });
    }

    const response = await fetch(reapUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/vnd.dashboard+json; version=1.0.0',
        'x-reap-api-key': apiKey,
        'x-reap-entity-id': entityId
      }
    });

    let responseData;
    try {
      responseData = await response.json();
    } catch (parseError) {
      console.error('Failed to parse Reap API response:', parseError);
      responseData = { message: 'Invalid response from Reap API' };
    }

    if (response.ok) {
      res.status(200).json({
        success: true,
        message: 'Account balance retrieved successfully',
        data: responseData
      });
    } else {
      res.status(response.status).json({
        success: false,
        message: responseData.message || 'Failed to get account balance',
        error: responseData
      });
    }

  } catch (error) {
    console.error('Get account balance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while retrieving account balance'
    });
  }
};

export {
  simulateFundAccount,
  simulatePaymentLifecycle,
  simulateTrackingLifecycle,
  getAccountBalance
};
