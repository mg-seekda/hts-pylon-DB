const fs = require('fs');
const path = require('path');

/**
 * Simple console-to-file logger that doesn't fail on startup
 */
class SimpleLogger {
  constructor() {
    this.logDir = '/app/logs';
    this.initialized = false;
    this.originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info
    };
    
    // Initialize after a delay to avoid startup issues
    setTimeout(() => {
      this.initialize();
    }, 2000);
  }

  initialize() {
    try {
      // Create logs directory
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }

      // Create log files
      this.appLog = fs.createWriteStream(path.join(this.logDir, 'app.log'), { flags: 'a' });
      this.errorLog = fs.createWriteStream(path.join(this.logDir, 'error.log'), { flags: 'a' });

      // Override console methods
      console.log = (...args) => {
        this.originalConsole.log(...args);
        if (this.appLog) {
          this.appLog.write(`[${new Date().toISOString()}] [INFO] ${args.join(' ')}\n`);
        }
      };

      console.error = (...args) => {
        this.originalConsole.error(...args);
        if (this.errorLog) {
          this.errorLog.write(`[${new Date().toISOString()}] [ERROR] ${args.join(' ')}\n`);
        }
      };

      console.warn = (...args) => {
        this.originalConsole.warn(...args);
        if (this.appLog) {
          this.appLog.write(`[${new Date().toISOString()}] [WARN] ${args.join(' ')}\n`);
        }
      };

      console.info = (...args) => {
        this.originalConsole.info(...args);
        if (this.appLog) {
          this.appLog.write(`[${new Date().toISOString()}] [INFO] ${args.join(' ')}\n`);
        }
      };

      this.initialized = true;
      this.originalConsole.log('📝 File logging initialized successfully');
    } catch (error) {
      this.originalConsole.error('Failed to initialize file logging:', error.message);
      // Continue without file logging
    }
  }

  close() {
    if (this.initialized) {
      try {
        if (this.appLog) this.appLog.end();
        if (this.errorLog) this.errorLog.end();
      } catch (error) {
        this.originalConsole.error('Error closing log files:', error.message);
      }
    }
  }
}

// Create singleton instance
const simpleLogger = new SimpleLogger();

// Graceful shutdown
process.on('SIGINT', () => {
  simpleLogger.close();
});

process.on('SIGTERM', () => {
  simpleLogger.close();
});

module.exports = simpleLogger;
