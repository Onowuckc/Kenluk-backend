const getCompanyPaymentEmails = () => {
  const configuredEmails = process.env.COMPANY_PAYMENT_EMAILS || 'payments@kenluk.com';

  return configuredEmails
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
};

const isCompanyPaymentAccount = (user) => {
  if (!user) return false;

  const email = user.email?.toLowerCase();
  return user.accountType === 'company' || getCompanyPaymentEmails().includes(email);
};

export { getCompanyPaymentEmails, isCompanyPaymentAccount };
