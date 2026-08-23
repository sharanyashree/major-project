const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'ration_distribution_jwt_secret_key_2026';

/**
 * Middleware to protect routes and verify JWT Token
 */
const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];
      

      // Verify token
      const decoded = jwt.verify(token, JWT_SECRET);

      // Attach user information to request object
      req.user = decoded;

      next();
    } catch (error) {
      console.error("JWT Verification Error:", error.message);
      return res.status(401).json({
        success: false,
        message: 'Not authorized, token failed or expired',
      });
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, no authentication token provided',
    });
  }
};

/**
 * Middleware to restrict access based on user roles
 * Example usage: authorize('Admin', 'Distributor')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user ? req.user.role : 'Guest'}' is not authorized to access this route`,
      });
    }
    next();
  };
};

module.exports = {
  protect,
  authorize,
};
