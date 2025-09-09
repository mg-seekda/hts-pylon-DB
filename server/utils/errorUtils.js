/**
 * Utility functions for safe error logging
 */

/**
 * Sanitizes an error object to prevent exposure of sensitive data
 * @param {Error} error - The error to sanitize
 * @param {string} context - Additional context about where the error occurred
 * @returns {Object} Sanitized error object
 */
function sanitizeError(error, context = '') {
  const sanitized = {
    message: error.message,
    code: error.code,
    name: error.name,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
  };

  // Handle axios errors specifically
  if (error.response) {
    sanitized.status = error.response.status;
    sanitized.statusText = error.response.statusText;
    sanitized.data = error.response.data;
    
    // Remove sensitive headers
    if (error.config && error.config.headers) {
      sanitized.headers = { ...error.config.headers };
      // Remove authorization header
      if (sanitized.headers.Authorization) {
        sanitized.headers.Authorization = '[REDACTED]';
      }
      if (sanitized.headers.authorization) {
        sanitized.headers.authorization = '[REDACTED]';
      }
    }
  }

  // Handle request config
  if (error.config) {
    sanitized.config = {
      method: error.config.method,
      url: error.config.url,
      baseURL: error.config.baseURL,
      timeout: error.config.timeout
    };
  }

  return sanitized;
}

/**
 * Safely logs an error without exposing sensitive data
 * @param {string} message - Log message
 * @param {Error} error - Error to log
 * @param {string} context - Additional context
 */
function logError(message, error, context = '') {
  const sanitized = sanitizeError(error, context);
  const contextStr = context ? ` (${context})` : '';
  console.error(`${message}${contextStr}:`, sanitized);
}

module.exports = {
  sanitizeError,
  logError
};
