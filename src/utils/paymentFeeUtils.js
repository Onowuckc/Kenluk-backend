const PAYMENT_FEE_AMOUNT = 30;

const calculatePaymentFeeBreakdown = (amount, currency = 'USD') => {
  const numericAmount = Number(amount || 0);

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return {
      currency,
      processingFee: 0,
      amountToBeneficiary: 0,
      totalChargedAmount: 0,
      feeDescription: 'No fee applied'
    };
  }

  const processingFee = currency === 'USD' ? PAYMENT_FEE_AMOUNT : 0;
  const amountToBeneficiary = Math.max(0, numericAmount - processingFee);

  return {
    currency,
    processingFee,
    amountToBeneficiary,
    totalChargedAmount: numericAmount,
    feeDescription: processingFee > 0
      ? `A ${currency} ${processingFee.toFixed(2)} processing fee is deducted from the payment.`
      : 'No processing fee applied.'
  };
};

export { PAYMENT_FEE_AMOUNT, calculatePaymentFeeBreakdown };
export default calculatePaymentFeeBreakdown;
