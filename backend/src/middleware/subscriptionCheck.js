/**
 * Subscription Check Middleware
 *
 * Enforces subscription status for agencies.
 * Expired subscriptions get read-only access.
 */

/**
 * Check if the agency subscription has expired
 */
function isSubscriptionExpired(agency) {
  if (!agency) return false;
  if (!agency.subscription_expires_at) return false;

  const expiryDate = new Date(agency.subscription_expires_at);
  return expiryDate < new Date();
}

/**
 * Subscription check middleware
 *
 * For expired subscriptions:
 * - Allow GET requests (read-only)
 * - Block all other methods (POST, PUT, PATCH, DELETE)
 */
const subscriptionCheck = (req, res, next) => {
  // Skip if no agency context
  if (!req.agency) {
    return next();
  }

  // Check if subscription is expired
  if (isSubscriptionExpired(req.agency)) {
    // Allow read operations
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      // Add warning header
      res.set('X-Subscription-Status', 'expired');
      return next();
    }

    // Block write operations
    return res.status(403).json({
      error: 'Subscription Expired',
      message: 'Your subscription has expired. Your account is in read-only mode. Please contact support to renew.',
      subscription_status: 'expired',
      expired_at: req.agency.subscription_expires_at
    });
  }

  next();
};

/**
 * Require active subscription middleware
 *
 * Use for features that absolutely require an active subscription
 * (e.g., creating new tenancies, sending emails)
 */
const requireActiveSubscription = (req, res, next) => {
  if (!req.agency) {
    return next();
  }

  if (isSubscriptionExpired(req.agency)) {
    return res.status(403).json({
      error: 'Subscription Required',
      message: 'This feature requires an active subscription. Please contact support to renew.',
      subscription_status: 'expired',
      expired_at: req.agency.subscription_expires_at
    });
  }

  next();
};

/**
 * Check if agency has premium tier
 */
const requirePremium = (req, res, next) => {
  if (!req.agency) {
    return res.status(400).json({
      error: 'Agency Required',
      message: 'This endpoint requires an agency context'
    });
  }

  if (req.agency.subscription_tier !== 'premium') {
    return res.status(403).json({
      error: 'Premium Required',
      message: 'This feature requires a premium subscription. Please upgrade to access this feature.',
      current_tier: req.agency.subscription_tier
    });
  }

  if (isSubscriptionExpired(req.agency)) {
    return res.status(403).json({
      error: 'Subscription Expired',
      message: 'Your premium subscription has expired. Please renew to access this feature.',
      subscription_status: 'expired'
    });
  }

  next();
};

module.exports = {
  subscriptionCheck,
  requireActiveSubscription,
  requirePremium,
  isSubscriptionExpired
};
