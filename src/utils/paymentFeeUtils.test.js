import { calculatePaymentFeeBreakdown } from './paymentFeeUtils.js';

describe('calculatePaymentFeeBreakdown', () => {
  it('deducts a $30 fee and keeps the amount charged at the original request', () => {
    const breakdown = calculatePaymentFeeBreakdown(23000, 'USD');

    expect(breakdown.processingFee).toBe(30);
    expect(breakdown.amountToBeneficiary).toBe(22970);
    expect(breakdown.totalChargedAmount).toBe(23000);
  });

  it('returns zero fee for non-positive amounts', () => {
    const breakdown = calculatePaymentFeeBreakdown(0, 'USD');

    expect(breakdown.processingFee).toBe(0);
    expect(breakdown.amountToBeneficiary).toBe(0);
  });
});
