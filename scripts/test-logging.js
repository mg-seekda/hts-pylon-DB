const logger = require('../server/utils/logger');

console.log('Testing file logging...');

// Test different log levels
logger.info('This is an info message');
logger.warn('This is a warning message');
logger.error('This is an error message');
logger.debug('This is a debug message');

// Test with objects
logger.info('Testing object logging', { 
  userId: 123, 
  action: 'test',
  data: { nested: 'value' }
});

// Test error logging
try {
  throw new Error('Test error for logging');
} catch (error) {
  logger.error('Caught test error:', error);
}

console.log('Logging test completed. Check /app/logs directory for files:');
console.log('- app.log (info, warn messages)');
console.log('- error.log (error messages)');
console.log('- debug.log (debug messages)');

// Close logger
setTimeout(() => {
  logger.close();
  console.log('Logger closed.');
  process.exit(0);
}, 1000);
