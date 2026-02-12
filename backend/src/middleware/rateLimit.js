/**
 * Rate Limiting Middleware
 *
 * Provides both IP-based and agency-based rate limiting.
 * Supports per-agency rate limits for API endpoints.
 */

const rateLimitStore = new Map();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of rateLimitStore.entries()) {
    if (now - data.windowStart > data.windowMs * 2) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Create a rate limiter middleware
 * @param {Object} options
 * @param {number} options.windowMs - Time window in milliseconds (default: 15 minutes)
 * @param {number} options.maxRequests - Maximum requests per window (default: 100)
 * @param {string} options.message - Error message when rate limited
 * @param {boolean} options.useAgencyLimit - Use agency-specific rate limit
 * @param {string} options.keyGenerator - Custom key generator function
 */
const createRateLimiter = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    maxRequests = 100,
    message = 'Too many requests, please try again later',
    useAgencyLimit = false,
    keyGenerator = null
  } = options;

  return (req, res, next) => {
    let key;
    let limit = maxRequests;

    if (keyGenerator) {
      // Custom key generator
      key = keyGenerator(req);
    } else if (useAgencyLimit && req.agencyId) {
      // Agency-based rate limiting
      key = `agency:${req.agencyId}:${req.path}`;
      // Use agency's custom rate limit if set
      if (req.agency && req.agency.api_rate_limit) {
        limit = req.agency.api_rate_limit;
      }
    } else {
      // IP-based rate limiting (default)
      const ip = req.ip ||
                 req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                 req.connection?.remoteAddress ||
                 'unknown';
      key = `ip:${ip}:${req.path}`;
    }

    const now = Date.now();
    let record = rateLimitStore.get(key);

    if (!record || now - record.windowStart > windowMs) {
      // Start new window
      record = {
        windowStart: now,
        windowMs,
        count: 1
      };
      rateLimitStore.set(key, record);

      // Set rate limit headers
      res.set('X-RateLimit-Limit', limit);
      res.set('X-RateLimit-Remaining', limit - 1);
      res.set('X-RateLimit-Reset', Math.ceil((now + windowMs) / 1000));

      return next();
    }

    record.count++;

    // Set rate limit headers
    res.set('X-RateLimit-Limit', limit);
    res.set('X-RateLimit-Remaining', Math.max(0, limit - record.count));
    res.set('X-RateLimit-Reset', Math.ceil((record.windowStart + windowMs) / 1000));

    if (record.count > limit) {
      const retryAfter = Math.ceil((record.windowStart + windowMs - now) / 1000);
      console.log(`Rate limit exceeded for ${key} (${record.count} requests)`);

      res.set('Retry-After', retryAfter);

      return res.status(429).json({
        error: 'Rate Limit Exceeded',
        message,
        retryAfter
      });
    }

    next();
  };
};

/**
 * Create an agency-aware rate limiter
 * Uses the agency's configured rate limit if available
 */
const createAgencyRateLimiter = (options = {}) => {
  return createRateLimiter({
    ...options,
    useAgencyLimit: true
  });
};

// Pre-configured rate limiters for common use cases
const viewingRequestLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 requests per 15 minutes per IP
  message: 'Too many viewing requests. Please try again in a few minutes.'
});

const contactFormLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 10,
  message: 'Too many contact requests. Please try again later.'
});

const strictLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 3,
  message: 'Too many requests. Please slow down.'
});

const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10, // 10 login attempts per 15 minutes
  message: 'Too many login attempts. Please try again later.'
});

const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10,
  message: 'Too many login attempts. Please try again in a few minutes.'
});

const registerLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 5,
  message: 'Too many registration attempts. Please try again later.'
});

const passwordResetLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 5,
  message: 'Too many password reset requests. Please try again later.'
});

const setupTokenLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10,
  message: 'Too many setup attempts. Please try again later.'
});

const apiLimiter = createAgencyRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 1000, // Default, can be overridden by agency setting
  message: 'API rate limit exceeded. Please reduce request frequency.'
});

module.exports = {
  createRateLimiter,
  createAgencyRateLimiter,
  viewingRequestLimiter,
  contactFormLimiter,
  strictLimiter,
  authLimiter,
  loginLimiter,
  registerLimiter,
  passwordResetLimiter,
  setupTokenLimiter,
  apiLimiter
};
