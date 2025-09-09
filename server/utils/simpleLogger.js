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
      // Helper function to format arguments properly
      const formatArgs = (args) => {
        return args.map(arg => {
          if (typeof arg === 'object' && arg !== null) {
            try {
              return JSON.stringify(arg, null, 2);
            } catch (error) {
              return `[Circular Object: ${Object.prototype.toString.call(arg)}]`;
            }
          }
          if (typeof arg === 'function') {
            return `[Function: ${arg.name || 'anonymous'}]`;
          }
          if (typeof arg === 'undefined') {
            return 'undefined';
          }
          return String(arg);
        }).join(' ');
      };

      // Enhanced logging with better formatting
      const writeLog = (level, args, stream) => {
        const timestamp = new Date().toISOString();
        const formattedMessage = formatArgs(args);
        const logEntry = `[${timestamp}] [${level}] ${formattedMessage}\n`;
        
        if (stream) {
          stream.write(logEntry);
        }
      };

      console.log = (...args) => {
        this.originalConsole.log(...args);
        writeLog('INFO', args, this.appLog);
      };

      console.error = (...args) => {
        this.originalConsole.error(...args);
        writeLog('ERROR', args, this.errorLog);
        // Also write errors to app log for completeness
        writeLog('ERROR', args, this.appLog);
      };

      console.warn = (...args) => {
        this.originalConsole.warn(...args);
        writeLog('WARN', args, this.appLog);
      };

      console.info = (...args) => {
        this.originalConsole.info(...args);
        writeLog('INFO', args, this.appLog);
      };

      // Add debug method
      console.debug = (...args) => {
        this.originalConsole.debug(...args);
        writeLog('DEBUG', args, this.appLog);
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
        // Restore original console methods
        console.log = this.originalConsole.log;
        console.error = this.originalConsole.error;
        console.warn = this.originalConsole.warn;
        console.info = this.originalConsole.info;
        console.debug = this.originalConsole.debug || console.log;
        
        // Close log streams
        if (this.appLog) {
          this.appLog.end();
          this.appLog = null;
        }
        if (this.errorLog) {
          this.errorLog.end();
          this.errorLog = null;
        }
        
        this.initialized = false;
        this.originalConsole.log('📝 File logging closed');
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
