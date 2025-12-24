/**
 * Middleware to enforce account approval for restricted features
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const requireAccountApproval = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (req.user.accountStatus !== 'approved') {
    return res.status(403).json({
      success: false,
      message: 'Account approval required to access this feature'
    });
  }

  next();
};

export { requireAccountApproval };
